import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { sanitizeString } from '@/utils/security';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  amount: z.number().min(0).max(1_000_000),
});

// Client adds a milestone to a project they own. The write goes through the
// admin client after ownership is verified, so the money tables don't need
// permissive RLS insert policies.
export async function POST(req: NextRequest) {
  try {
    const { success } = await rateLimit(`milestones:${clientIp(req)}`);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, title, description, amount } = schema.parse(await req.json());

    // Verify the caller owns the project (RLS lets a client read their own).
    const { data: project } = await supabase
      .from('projects')
      .select('id, client_id')
      .eq('id', projectId)
      .single();
    if (!project || project.client_id !== user.id) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('milestones')
      .insert({
        project_id: projectId,
        title: sanitizeString(title, 200),
        description: sanitizeString(description ?? '', 2000),
        amount,
        status: 'pending',
      })
      .select('id')
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    console.error('Create milestone failed:', error);
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
  }
}
