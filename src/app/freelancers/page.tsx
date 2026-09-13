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

interface FreelancerRow {
  id: string;
  title: string;
  bio: string;
  location: string;
  hourly_rate: number;
  rating: number;
  review_count: number;
  skills: string[] | null;
  profiles: { name: string } | null;
}

export default function FreelancersPage() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<FreelancerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'freelancers', sort: 'rating', limit: '20' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error('Request failed');
      const json = await res.json();
      setRows((json.data as FreelancerRow[]) || []);
    } catch {
      setError('Could not load freelancers. Please try again.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows('');
  }, [fetchRows]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchRows(query);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Find talent</h1>
          <p className="mt-2 text-slate-600">Browse vetted freelancers ready to work on BridgeofTalent.</p>
        </div>

        <form onSubmit={onSearch} className="mb-8 flex gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, skill or keyword…"
            className="max-w-md"
          />
          <Button type="submit">Search</Button>
        </form>

        {loading ? (
          <p className="text-slate-500">Loading freelancers…</p>
        ) : error ? (
          <p className="text-error">{error}</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              No freelancers found yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((f) => (
              <Link key={f.id} href={`/freelancers/${f.id}` as Route} className="block">
                <Card className="h-full transition hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                          {f.profiles?.name || 'Freelancer'}
                        </h2>
                        <p className="text-sm text-slate-500">{f.title}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(f.hourly_rate)}/hr</p>
                        {f.review_count > 0 && (
                          <p className="text-xs text-slate-500">
                            ★ {Number(f.rating).toFixed(1)} ({f.review_count})
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">{f.bio}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {f.location && <Badge variant="neutral">{f.location}</Badge>}
                      {(f.skills || []).slice(0, 4).map((s) => (
                        <Badge key={s} variant="brand">
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
