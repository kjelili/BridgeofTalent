import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApplyForm } from '@/components/apply-form';
import { BidActions } from '@/components/bid-actions';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type BidStatus = 'pending' | 'accepted' | 'rejected';

function statusVariant(status: BidStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'accepted') return 'success';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: job } = await supabase.from('jobs').select('*').eq('id', params.id).single();

  if (!job) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = !!user && user.id === job.client_id;

  let role: string | null = null;
  let myBidStatus: BidStatus | null = null;
  let bids: Array<{
    id: string;
    freelancer_name: string;
    amount: number;
    timeline: string;
    message: string;
    status: BidStatus;
  }> = [];

  if (user && !isOwner) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = profile?.role ?? null;
    const { data: myBid } = await supabase
      .from('bids')
      .select('status')
      .eq('job_id', job.id)
      .eq('freelancer_id', user.id)
      .maybeSingle();
    myBidStatus = (myBid?.status as BidStatus | undefined) ?? null;
  }

  if (isOwner) {
    const { data } = await supabase
      .from('bids')
      .select('id, freelancer_name, amount, timeline, message, status')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false });
    bids = (data as typeof bids) || [];
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to jobs
        </Link>

        <Card className="mt-4">
          <CardContent className="p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Posted by {job.client_name} · {job.location}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-900">
                  {formatCurrency(job.budget_min)}–{formatCurrency(job.budget_max)}
                </p>
                <p className="text-xs text-slate-500">{job.budget_type} budget</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="brand">{job.category}</Badge>
              {job.status !== 'open' && <Badge variant="neutral">{job.status}</Badge>}
              {(job.skills || []).map((s: string) => (
                <Badge key={s} variant="neutral">
                  {s}
                </Badge>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Description</h2>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">{job.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Applicant / owner section */}
        {!user && (
          <Card className="mt-6">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-slate-600">Sign in as a freelancer to apply for this job.</p>
              <Link href={`/sign-in?redirect=/jobs/${job.id}` as Route}>
                <Button>Sign in to apply</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {user && !isOwner && role === 'freelancer' && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Apply for this job</h2>
              {myBidStatus ? (
                <p className="text-slate-600">
                  You&apos;ve already applied. Status:{' '}
                  <Badge variant={statusVariant(myBidStatus)}>{myBidStatus}</Badge>
                </p>
              ) : job.status === 'open' ? (
                <ApplyForm jobId={job.id} />
              ) : (
                <p className="text-slate-600">This job is no longer accepting applications.</p>
              )}
            </CardContent>
          </Card>
        )}

        {user && !isOwner && role !== 'freelancer' && (
          <Card className="mt-6">
            <CardContent className="p-6 text-slate-600">
              You&apos;re signed in as a client.{' '}
              <Link href="/post-job" className="font-semibold text-brand-600 hover:text-brand-700">
                Post your own job
              </Link>{' '}
              to start hiring.
            </CardContent>
          </Card>
        )}

        {isOwner && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Applications ({bids.length})
              </h2>
              {bids.length === 0 ? (
                <p className="text-slate-500">No applications yet.</p>
              ) : (
                <div className="space-y-4">
                  {bids.map((bid) => (
                    <div key={bid.id} className="rounded-lg border border-slate-100 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{bid.freelancer_name}</p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {formatCurrency(bid.amount)} · {bid.timeline}
                          </p>
                        </div>
                        {bid.status === 'pending' ? (
                          <BidActions bidId={bid.id} />
                        ) : (
                          <Badge variant={statusVariant(bid.status)}>{bid.status}</Badge>
                        )}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{bid.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
