import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sanitizeProfileInput } from '@/utils/security';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().max(200),
  bio: z.string().max(2000),
  location: z.string().max(120),
  hourlyRate: z.number().min(0).max(10000),
  skills: z.array(z.string()).max(30),
});

// Current freelancer updates their own public profile.
export async function PATCH(req: NextRequest) {
  try {
    const { success } = await rateLimit(`freelancer:${clientIp(req)}`);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.parse(await req.json());
    const clean = sanitizeProfileInput(parsed);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name: clean.name })
      .eq('id', user.id);
    if (profileError) throw profileError;

    const { error: freelancerError } = await supabase.from('freelancers').upsert(
      {
        id: user.id,
        title: clean.title,
        bio: clean.bio,
        location: clean.location,
        hourly_rate: clean.hourlyRate,
        skills: clean.skills,
        availability_status: 'available',
      },
      { onConflict: 'id' }
    );
    if (freelancerError) throw freelancerError;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    console.error('Update freelancer failed:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
