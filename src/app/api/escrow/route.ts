import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import { getStripe } from '@/services/stripe';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const PLATFORM_FEE = 0.05;
const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

const fundSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  amount: z.number().positive().max(100_000),
});

const actionSchema = z.object({
  escrowId: z.string().uuid(),
  action: z.enum(['release', 'dispute']).default('release'),
});

// Client funds a milestone into escrow. Financial rows are written with the
// admin client after ownership is verified. When Stripe is configured a real
// PaymentIntent is created and the escrow stays 'pending' until the webhook
// confirms payment; without Stripe (demo) it is marked 'held' so the flow is
// exercisable end to end.
export async function POST(req: NextRequest) {
  try {
    const { success } = await rateLimit(`escrow:${clientIp(req)}`);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, milestoneId, amount } = fundSchema.parse(await req.json());

    const { data: project } = await supabase
      .from('projects')
      .select('id, client_id')
      .eq('id', projectId)
      .single();
    if (!project || project.client_id !== user.id) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 403 });
    }

    const platformFee = Math.round(amount * PLATFORM_FEE * 100) / 100;
    const admin = createAdminClient();

    let stripePaymentIntentId: string | null = null;
    let clientSecret: string | null = null;
    if (stripeConfigured()) {
      const intent = await getStripe().paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: { type: 'escrow_funding', clientId: user.id, projectId, milestoneId },
      });
      stripePaymentIntentId = intent.id;
      clientSecret = intent.client_secret;
    }

    const { data: escrow, error: escrowError } = await admin
      .from('escrow_accounts')
      .insert({
        project_id: projectId,
        client_id: user.id,
        total_amount: amount,
        platform_fee: platformFee,
        freelancer_payout: amount - platformFee,
        stripe_payment_intent_id: stripePaymentIntentId,
        milestone_id: milestoneId,
        status: stripeConfigured() ? 'pending' : 'held',
      })
      .select('id')
      .single();
    if (escrowError) throw escrowError;

    await admin.from('milestones').update({ status: 'funded' }).eq('id', milestoneId);
    await admin.from('transactions').insert({
      escrow_id: escrow?.id,
      user_id: user.id,
      type: 'deposit',
      amount,
      description: 'Escrow funded',
    });

    return NextResponse.json({ success: true, clientSecret });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    console.error('Escrow funding failed:', error);
    return NextResponse.json({ error: 'Failed to fund escrow' }, { status: 500 });
  }
}

// Client releases escrow funds to the freelancer, or opens a dispute.
export async function PATCH(req: NextRequest) {
  try {
    const { success } = await rateLimit(`escrow:${clientIp(req)}`);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { escrowId, action } = actionSchema.parse(await req.json());

    const { data: escrow } = await supabase
      .from('escrow_accounts')
      .select('id, project_id, milestone_id, total_amount, freelancer_payout, projects(client_id)')
      .eq('id', escrowId)
      .single();
    if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
    if (escrow.projects?.client_id !== user.id) {
      return NextResponse.json({ error: 'Only the client can do that.' }, { status: 403 });
    }

    const admin = createAdminClient();

    if (action === 'dispute') {
      await admin.from('escrow_accounts').update({ status: 'disputed' }).eq('id', escrowId);
      await admin.from('disputes').insert({
        project_id: escrow.project_id,
        raised_by: user.id,
        reason: 'Escrow dispute initiated',
      });
      return NextResponse.json({ success: true, message: 'Dispute opened' });
    }

    // Release: optionally transfer to the freelancer's connected Stripe account.
    if (stripeConfigured()) {
      const { data: member } = await admin
        .from('project_members')
        .select('freelancer_id, profiles(stripe_connect_id)')
        .eq('project_id', escrow.project_id)
        .limit(1)
        .single();
      const connectId = member?.profiles?.stripe_connect_id;
      if (connectId) {
        await getStripe().transfers.create({
          amount: Math.round(escrow.freelancer_payout * 100),
          currency: 'usd',
          destination: connectId,
          metadata: { escrowId, type: 'freelancer_payout' },
        });
      }
    }

    await admin
      .from('escrow_accounts')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', escrowId);
    if (escrow.milestone_id) {
      await admin.from('milestones').update({ status: 'approved' }).eq('id', escrow.milestone_id);
    }
    await admin.from('transactions').insert({
      escrow_id: escrowId,
      user_id: user.id,
      type: 'release',
      amount: escrow.total_amount,
      description: 'Escrow released to freelancer',
    });

    return NextResponse.json({ success: true, message: 'Funds released' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    console.error('Escrow action failed:', error);
    return NextResponse.json({ error: 'Failed to process escrow action' }, { status: 500 });
  }
}
