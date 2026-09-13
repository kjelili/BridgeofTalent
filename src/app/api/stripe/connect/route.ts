import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import { createConnectAccount, createAccountLink } from '@/services/stripe';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Starts Stripe Connect onboarding for the current freelancer and returns the
// hosted onboarding URL for the client to redirect to.
export async function POST(req: NextRequest) {
  try {
    const { success } = await rateLimit(`stripe-connect:${clientIp(req)}`);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_connect_id')
      .eq('id', user.id)
      .single();

    let accountId = profile?.stripe_connect_id ?? null;
    if (!accountId) {
      const account = await createConnectAccount(user.id, user.email || '');
      accountId = account.id;
    }

    const link = await createAccountLink(accountId);
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error('Stripe connect failed:', error);
    return NextResponse.json({ error: 'Failed to start onboarding' }, { status: 500 });
  }
}
