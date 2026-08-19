import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sanitizeJobInput } from '@/utils/security';

export const dynamic = 'force-dynamic';

const jobSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  category: z.string().min(1).max(64),
  location: z.string().max(64).optional(),
  budgetType: z.enum(['fixed', 'hourly']),
  budgetMin: z.number().min(0),
  budgetMax: z.number().min(0),
  skills: z.array(z.string()).max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = jobSchema.parse(body);
    const clean = sanitizeJobInput(parsed);

    const clientName =
      (user.user_metadata?.name as string | undefined) || user.email || 'Client';

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        client_id: user.id,
        client_name: clientName,
        title: clean.title,
        description: clean.description,
        category: clean.category,
        location: clean.location || 'Remote',
        budget_type: clean.budgetType as 'fixed' | 'hourly',
        budget_min: clean.budgetMin,
        budget_max: clean.budgetMax,
        skills: clean.skills,
        status: 'open',
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.flatten() },
        { status: 400 }
      );
    }
    console.error('Create job failed:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
