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

type BidStatus = 'pending' | 'accepted' | 'rejected';

function statusVariant(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'accepted') return 'success';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in?redirect=/dashboard');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();
  const role = profile?.role ?? 'client';
  const name = profile?.name || user.email;

  const isFreelancer = role === 'freelancer';

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
            {isFreelancer ? (
              <>
                <Link href="/jobs">
                  <Button>Find work</Button>
                </Link>
                <Link href="/profile">
                  <Button variant="secondary">Edit profile</Button>
                </Link>
                <Link href="/settings/payments">
                  <Button variant="secondary">Payouts</Button>
                </Link>
              </>
            ) : (
              <Link href="/post-job">
                <Button>Post a job</Button>
              </Link>
            )}
            <form action="/auth/sign-out" method="post">
              <Button type="submit" variant="ghost">
                Sign out
              </Button>
            </form>
          </div>
        </div>

        {isFreelancer ? (
          <FreelancerBoard userId={user.id} />
        ) : (
          <ClientBoard userId={user.id} />
        )}
      </main>
    </div>
  );
}

async function ClientBoard({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('client_id', userId)
    .order('created_at', { ascending: false });
  const myJobs = data || [];

  return (
    <>
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
                      {job.category} · {formatCurrency(job.budget_min)}–{formatCurrency(job.budget_max)}
                    </p>
                  </div>
                  <Badge variant={job.status === 'open' ? 'success' : 'neutral'}>{job.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <ProjectsSection userId={userId} role="client" />
    </>
  );
}

async function FreelancerBoard({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('bids')
    .select('id, amount, timeline, status, jobs(id, title, category)')
    .eq('freelancer_id', userId)
    .order('created_at', { ascending: false });
  const myBids = data || [];

  return (
    <>
      <h2 className="mb-4 mt-10 text-lg font-semibold text-slate-900">Your applications</h2>
      {myBids.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-500">
            You haven&apos;t applied to any jobs yet.{' '}
            <Link href="/jobs" className="font-semibold text-brand-600 hover:text-brand-700">
              Find work
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {myBids.map((bid) => {
            const job = bid.jobs;
            const inner = (
              <Card className="transition hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4 p-6">
                  <div>
                    <h3 className="font-semibold text-slate-900">{job?.title || 'Job'}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Your bid: {formatCurrency(bid.amount)} · {bid.timeline}
                    </p>
                  </div>
                  <Badge variant={statusVariant(bid.status)}>{bid.status as BidStatus}</Badge>
                </CardContent>
              </Card>
            );
            return job?.id ? (
              <Link key={bid.id} href={`/jobs/${job.id}` as Route} className="block">
                {inner}
              </Link>
            ) : (
              <div key={bid.id}>{inner}</div>
            );
          })}
        </div>
      )}
      <ProjectsSection userId={userId} role="freelancer" />
    </>
  );
}

async function ProjectsSection({
  userId,
  role,
}: {
  userId: string;
  role: 'client' | 'freelancer';
}) {
  const supabase = await createServerSupabaseClient();
  let projects: Array<{ id: string; title: string; status: string; client_name: string }> = [];

  if (role === 'client') {
    const { data } = await supabase
      .from('projects')
      .select('id, title, status, client_name')
      .eq('client_id', userId)
      .order('created_at', { ascending: false });
    projects = data || [];
  } else {
    const { data } = await supabase
      .from('project_members')
      .select('projects(id, title, status, client_name)')
      .eq('freelancer_id', userId);
    projects = ((data || [])
      .map((r) => r.projects)
      .filter(Boolean) as unknown) as typeof projects;
  }

  if (projects.length === 0) return null;

  return (
    <>
      <h2 className="mb-4 mt-10 text-lg font-semibold text-slate-900">Your projects</h2>
      <div className="space-y-4">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}` as Route} className="block">
            <Card className="transition hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4 p-6">
                <div>
                  <h3 className="font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">Client: {p.client_name}</p>
                </div>
                <Badge variant={p.status === 'active' ? 'warning' : 'success'}>{p.status}</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
