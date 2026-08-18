import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { createEscrowPaymentIntent, releaseEscrowFunds } from '@/services/stripe';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const fundSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  amount: z.number().positive().max(100000),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { projectId, milestoneId, amount } = fundSchema.parse(body);

    const { data: project } = await supabase
      .from('projects').select('*').eq('id', projectId).eq('client_id', user.id).single();
    if (!project) return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 403 });

    const { data: milestone } = await supabase
      .from('milestones').select('*').eq('id', milestoneId).eq('project_id', projectId).single();
    if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

    const paymentIntent = await createEscrowPaymentIntent({ amount, clientId: user.id, projectId, milestoneId });
    const platformFee = amount * 0.05;

    await supabase.from('escrow_accounts').insert({
      project_id: projectId, client_id: user.id, total_amount: amount,
      platform_fee: platformFee, freelancer_payout: amount - platformFee,
      stripe_payment_intent_id: paymentIntent.id, status: 'pending',
    });
    await supabase.from('milestones').update({ status: 'funded' }).eq('id', milestoneId);

    return NextResponse.json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Escrow funding failed:', error);
    return NextResponse.json({ error: 'Failed to fund escrow' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { escrowId, action } = await req.json();
    const { data: escrow } = await supabase
      .from('escrow_accounts').select('*, projects(client_id)').eq('id', escrowId).single();
    if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });

    if (action === 'release') {
      if (escrow.projects?.client_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      const { data: freelancer } = await supabase
        .from('project_members')
        .select('freelancer_id, profiles(stripe_connect_id)')
        .eq('project_id', escrow.project_id).limit(1).single();
      if (!freelancer?.profiles?.stripe_connect_id) {
        return NextResponse.json({ error: 'Freelancer payment account not set up' }, { status: 400 });
      }
      await releaseEscrowFunds({
        escrowId, freelancerStripeAccountId: freelancer.profiles.stripe_connect_id, amount: escrow.total_amount,
      });
      return NextResponse.json({ success: true, message: 'Funds released' });
    }

    if (action === 'dispute') {
      await supabase.from('escrow_accounts').update({ status: 'disputed' }).eq('id', escrowId);
      await supabase.from('disputes').insert({ project_id: escrow.project_id, raised_by: user.id, reason: 'Escrow dispute initiated' });
      return NextResponse.json({ success: true, message: 'Dispute opened' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Escrow action failed:', error);
    return NextResponse.json({ error: 'Failed to process escrow action' }, { status: 500 });
  }
}
