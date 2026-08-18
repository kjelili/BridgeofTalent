import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const searchSchema = z.object({
  q: z.string().max(200).optional(),
  type: z.enum(['jobs', 'freelancers']).default('jobs'),
  category: z.string().optional(),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().optional(),
  skills: z.string().optional(),
  location: z.string().optional(),
  sort: z.enum(['relevance', 'newest', 'budget_high', 'budget_low', 'rating']).default('relevance'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const searchParams = req.nextUrl.searchParams;
    const params = searchSchema.parse({
      q: searchParams.get('q') || undefined,
      type: searchParams.get('type') || 'jobs',
      category: searchParams.get('category') || undefined,
      minBudget: searchParams.get('minBudget') || undefined,
      maxBudget: searchParams.get('maxBudget') || undefined,
      skills: searchParams.get('skills') || undefined,
      location: searchParams.get('location') || undefined,
      sort: searchParams.get('sort') || 'relevance',
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    });

    const { type, q, category, minBudget, maxBudget, skills, location, sort, page, limit } = params;
    const offset = (page - 1) * limit;
    let query;

    if (type === 'jobs') {
      query = supabase.from('jobs').select('*, profiles(name, avatar_url)', { count: 'exact' }).eq('status', 'open');
      if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      if (category) query = query.eq('category', category);
      if (minBudget) query = query.gte('budget_min', minBudget);
      if (maxBudget) query = query.lte('budget_max', maxBudget);
      if (location) query = query.ilike('location', `%${location}%`);
      if (skills) query = query.contains('skills', skills.split(',').map((s) => s.trim()));
      switch (sort) {
        case 'newest': query = query.order('created_at', { ascending: false }); break;
        case 'budget_high': query = query.order('budget_max', { ascending: false }); break;
        case 'budget_low': query = query.order('budget_min', { ascending: true }); break;
        default: query = query.order('created_at', { ascending: false });
      }
    } else {
      query = supabase.from('freelancers').select('*, profiles(name, avatar_url)', { count: 'exact' }).eq('availability_status', 'available');
      if (q) query = query.or(`title.ilike.%${q}%,bio.ilike.%${q}%`);
      if (minBudget) query = query.gte('hourly_rate', minBudget);
      if (maxBudget) query = query.lte('hourly_rate', maxBudget);
      if (location) query = query.ilike('location', `%${location}%`);
      if (skills) query = query.contains('skills', skills.split(',').map((s) => s.trim()));
      switch (sort) {
        case 'rating': query = query.order('rating', { ascending: false }); break;
        case 'newest': query = query.order('created_at', { ascending: false }); break;
        default: query = query.order('jss_score', { ascending: false });
      }
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({ data: data || [], total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
