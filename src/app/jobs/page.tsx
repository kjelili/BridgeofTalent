'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { SiteHeader } from '@/components/site-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface JobRow {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  budget_min: number;
  budget_max: number;
  budget_type: 'fixed' | 'hourly';
  skills: string[] | null;
  created_at: string;
}

export default function JobsPage() {
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'jobs', sort: 'newest', limit: '20' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error('Request failed');
      const json = await res.json();
      setJobs((json.data as JobRow[]) || []);
    } catch {
      setError('Could not load jobs. Please try again.');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs('');
  }, [fetchJobs]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchJobs(query);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Browse jobs</h1>
          <p className="mt-2 text-slate-600">Find your next project from open roles on BridgeofTalent.</p>
        </div>

        <form onSubmit={onSearch} className="mb-8 flex gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or keyword…"
            className="max-w-md"
          />
          <Button type="submit">Search</Button>
        </form>

        {loading ? (
          <p className="text-slate-500">Loading jobs…</p>
        ) : error ? (
          <p className="text-error">{error}</p>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              No open jobs found. Check back soon or{' '}
              <Link href="/post-job" className="font-semibold text-brand-600 hover:text-brand-700">
                post one yourself
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}` as Route} className="block">
                <Card className="transition hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{job.title}</h2>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{job.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-slate-900">
                          {formatCurrency(job.budget_min)}–{formatCurrency(job.budget_max)}
                        </p>
                        <p className="text-xs text-slate-500">{job.budget_type}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="brand">{job.category}</Badge>
                      <Badge variant="neutral">{job.location}</Badge>
                      {(job.skills || []).slice(0, 4).map((s) => (
                        <Badge key={s} variant="neutral">
                          {s}
                        </Badge>
                      ))}
                    </div>
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
