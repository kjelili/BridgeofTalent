import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AddMilestoneForm } from '@/components/add-milestone-form';
import { MilestoneActions } from '@/components/milestone-actions';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function milestoneVariant(status: string): 'neutral' | 'warning' | 'success' {
  if (status === 'approved') return 'success';
  if (status === 'funded' || status === 'submitted' || status === 'in_progress') return 'warning';
  return 'neutral';
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).single();

  if (!project) {
    notFound();
  }

  const isClient = !!user && user.id === project.client_id;

  const { data: milestones } = await supabase
    .from('milestones')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true });

  const { data: escrows } = await supabase
    .from('escrow_accounts')
    .select('id, milestone_id, status')
    .eq('project_id', project.id);

  const { data: members } = await supabase
    .from('project_members')
    .select('freelancer_id, profiles(name)')
    .eq('project_id', project.id);

  const escrowByMilestone = new Map<string, { id: string; status: string }>();
  for (const e of escrows || []) {
    if (e.milestone_id) escrowByMilestone.set(e.milestone_id, { id: e.id, status: e.status });
  }

  const myMilestones = milestones || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.title}</h1>
                <p className="mt-1 text-sm text-slate-500">Client: {project.client_name}</p>
              </div>
              <Badge variant={project.status === 'active' ? 'warning' : 'success'}>
                {project.status}
              </Badge>
            </div>
            {(members || []).length > 0 && (
              <p className="mt-4 text-sm text-slate-600">
                Team: {(members || []).map((m) => m.profiles?.name || 'Freelancer').join(', ')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="p-8">
            <h2 className="text-lg font-semibold text-slate-900">Milestones</h2>

            {myMilestones.length === 0 ? (
              <p className="mt-3 text-slate-500">No milestones yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {myMilestones.map((m) => {
                  const escrow = escrowByMilestone.get(m.id) || null;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-100 p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{m.title}</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {formatCurrency(m.amount)}{' '}
                          {escrow && (
                            <span className="text-slate-400">· escrow {escrow.status}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={milestoneVariant(m.status)}>{m.status}</Badge>
                        {isClient && m.status !== 'approved' && (
                          <MilestoneActions
                            projectId={project.id}
                            milestoneId={m.id}
                            amount={m.amount}
                            escrowId={escrow?.id ?? null}
                            escrowStatus={escrow?.status ?? null}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isClient && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <AddMilestoneForm projectId={project.id} />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
