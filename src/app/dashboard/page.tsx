import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in?redirect=/dashboard');
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });

  const name = (user.user_metadata?.name as string | undefined) || user.email;
  const myJobs = jobs || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="mt-1 text-slate-600">Welcome back, {name}.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/post-job">
              <Button>Post a job</Button>
            </Link>
            <form action="/auth/sign-out" method="post">
              <Button type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        </div>

        <h2 className="mb-4 mt-10 text-lg font-semibold text-slate-900">Your posted jobs</h2>

        {myJobs.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              You haven&apos;t posted any jobs yet.{' '}
              <Link href="/post-job" className="font-semibold text-brand-600 hover:text-brand-700">
                Post your first job
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {myJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}` as Route} className="block">
                <Card className="transition hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4 p-6">
                    <div>
                      <h3 className="font-semibold text-slate-900">{job.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {job.category} · {formatCurrency(job.budget_min)}–
                        {formatCurrency(job.budget_max)}
                      </p>
                    </div>
                    <Badge variant={job.status === 'open' ? 'success' : 'neutral'}>
                      {job.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
