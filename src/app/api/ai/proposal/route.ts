import { NextRequest, NextResponse } from 'next/server';
import { generateProposal } from '@/services/ai';
import { createServerSupabaseClient } from '@/lib/supabase';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({ jobId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { jobId } = schema.parse(body);

    const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const { data: freelancer } = await supabase
      .from('freelancers')
      .select('*, profiles(name)')
      .eq('id', user.id)
      .single();
    if (!freelancer) return NextResponse.json({ error: 'Freelancer profile not found' }, { status: 404 });

    const proposal = await generateProposal(job.description, job.title, {
      name: freelancer.profiles?.name || 'Freelancer',
      title: freelancer.title,
      skills: freelancer.skills || [],
      bio: freelancer.bio || '',
      hourlyRate: freelancer.hourly_rate,
    });

    return NextResponse.json({ success: true, proposal });
  } catch (error) {
    console.error('AI proposal generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate proposal' }, { status: 500 });
  }
}
