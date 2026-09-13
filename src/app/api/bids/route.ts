import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sanitizeBidInput } from '@/utils/security';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  jobId: z.string().uuid(),
  amount: z.number().min(0).max(1_000_000),
  message: z.string().min(1).max(5000),
  timeline: z.string().min(1).max(200),
});

const actionSchema = z.object({
  bidId: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
});

// Freelancer submits a bid on a job.
export async function POST(req: NextRequest) {
  try {
    const { success } = await rateLimit(`bids:${clientIp(req)}`);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, amount, message, timeline } = createSchema.parse(await req.json());
    const clean = sanitizeBidInput({ amount, message, timeline });

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
    const freelancerName = profile?.name || user.email || 'Freelancer';

    const { error } = await supabase.from('bids').insert({
      job_id: jobId,
      freelancer_id: user.id,
      freelancer_name: freelancerName,
      amount: clean.amount,
      message: clean.message,
      timeline: clean.timeline,
      status: 'pending',
    });

    if (error) {
      // Unique (job_id, freelancer_id) violation → already applied.
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already applied to this job.' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    console.error('Create bid failed:', error);
    return NextResponse.json({ error: 'Failed to submit bid' }, { status: 500 });
  }
}

// Job owner accepts or rejects a bid.
export async function PATCH(req: NextRequest) {
  try {
    const { success } = await rateLimit(`bids:${clientIp(req)}`);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { bidId, action } = actionSchema.parse(await req.json());

    const { data: bid } = await supabase
      .from('bids')
      .select('*, jobs(id, client_id, title, client_name)')
      .eq('id', bidId)
      .single();

    if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    if (bid.jobs?.client_id !== user.id) {
      return NextResponse.json({ error: 'Only the job owner can do that.' }, { status: 403 });
    }

    if (action === 'reject') {
      await supabase.from('bids').update({ status: 'rejected' }).eq('id', bidId);
      return NextResponse.json({ success: true });
    }

    // Accept: mark bid accepted, close the job, spin up a project + membership.
    await supabase.from('bids').update({ status: 'accepted' }).eq('id', bidId);
    await supabase.from('jobs').update({ status: 'closed' }).eq('id', bid.job_id);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        client_id: user.id,
        client_name: bid.jobs?.client_name || 'Client',
        title: bid.jobs?.title || 'Project',
        status: 'active',
      })
      .select('id')
      .single();
    if (projectError) throw projectError;

    if (project?.id) {
      await supabase
        .from('project_members')
        .insert({ project_id: project.id, freelancer_id: bid.freelancer_id });
    }

    return NextResponse.json({ success: true, projectId: project?.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    console.error('Bid action failed:', error);
    return NextResponse.json({ error: 'Failed to update bid' }, { status: 500 });
  }
}
