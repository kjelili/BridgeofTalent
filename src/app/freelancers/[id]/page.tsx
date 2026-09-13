import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FreelancerProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: freelancer } = await supabase
    .from('freelancers')
    .select('*, profiles(name, avatar_url, company)')
    .eq('id', params.id)
    .single();

  if (!freelancer) {
    notFound();
  }

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('freelancer_id', params.id)
    .order('created_at', { ascending: false });

  const name = freelancer.profiles?.name || 'Freelancer';
  const myReviews = reviews || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/freelancers" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to talent
        </Link>

        <Card className="mt-4">
          <CardContent className="p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
                <p className="mt-1 text-slate-600">{freelancer.title}</p>
                <p className="mt-1 text-sm text-slate-500">{freelancer.location}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-900">
                  {formatCurrency(freelancer.hourly_rate)}/hr
                </p>
                {freelancer.review_count > 0 && (
                  <p className="text-sm text-slate-500">
                    ★ {Number(freelancer.rating).toFixed(1)} ({freelancer.review_count} reviews)
                  </p>
                )}
                {freelancer.top_rated && (
                  <span className="mt-1 inline-block">
                    <Badge variant="accent">Top rated</Badge>
                  </span>
                )}
              </div>
            </div>

            {(freelancer.skills || []).length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {(freelancer.skills || []).map((s: string) => (
                  <Badge key={s} variant="brand">
                    {s}
                  </Badge>
                ))}
              </div>
            )}

            {freelancer.bio && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">About</h2>
                <p className="mt-3 whitespace-pre-wrap text-slate-700">{freelancer.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="p-8">
            <h2 className="text-lg font-semibold text-slate-900">Reviews ({myReviews.length})</h2>
            {myReviews.length === 0 ? (
              <p className="mt-3 text-slate-500">No reviews yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {myReviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-100 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-900">{r.client_name}</p>
                      <p className="text-sm text-amber-500">{'★'.repeat(Math.round(r.rating))}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
