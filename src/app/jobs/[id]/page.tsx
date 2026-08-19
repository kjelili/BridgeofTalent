import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: job } = await supabase.from('jobs').select('*').eq('id', params.id).single();

  if (!job) {
    notFound();
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

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="brand">{job.category}</Badge>
              {(job.skills || []).map((s: string) => (
                <Badge key={s} variant="neutral">
                  {s}
                </Badge>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Description
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">{job.description}</p>
            </div>

            <div className="mt-10 flex gap-3">
              <Link href={`/sign-in?redirect=/jobs/${job.id}` as Route}>
                <Button size="lg">Sign in to apply</Button>
              </Link>
              <Link href="/jobs">
                <Button size="lg" variant="secondary">
                  Browse more
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
