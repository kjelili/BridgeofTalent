import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConnectStripeButton } from '@/components/connect-stripe-button';

export const dynamic = 'force-dynamic';

export default async function PaymentsSettingsPage({
  searchParams,
}: {
  searchParams: { success?: string; refresh?: string };
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/sign-in?redirect=/settings/payments');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_id')
    .eq('id', user.id)
    .single();
  const connected = !!profile?.stripe_connect_id;

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Payout settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {searchParams.success && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                Your Stripe account is connected. You can now receive payouts.
              </div>
            )}
            {searchParams.refresh && (
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                Onboarding was interrupted. You can restart it below.
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Stripe Connect</p>
                <p className="text-sm text-slate-500">
                  Connect a Stripe account to receive escrow payouts when clients release funds.
                </p>
              </div>
              <Badge variant={connected ? 'success' : 'neutral'}>
                {connected ? 'Connected' : 'Not connected'}
              </Badge>
            </div>

            <ConnectStripeButton connected={connected} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
