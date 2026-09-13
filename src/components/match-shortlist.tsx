'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Match {
  freelancerId: string;
  score: number;
  skillMatch: number;
  rateMatch: number;
  experienceMatch: number;
  availabilityMatch: number;
  aiReasoning: string;
}

export function MatchShortlist({ jobId }: { jobId: string }) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not generate matches right now.');
        return;
      }
      setMatches(json.matches || []);
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Let AI rank the best-fit freelancers for this job.</p>
        <Button size="sm" onClick={generate} disabled={loading}>
          {loading ? 'Analyzing…' : '✨ Generate AI shortlist'}
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-error">{error}</p>}
      {matches && matches.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No strong matches found yet.</p>
      )}
      {matches && matches.length > 0 && (
        <div className="mt-4 space-y-3">
          {matches.map((m) => (
            <div key={m.freelancerId} className="rounded-lg border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                    {Math.round(m.score)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Match score {Math.round(m.score)}/100
                    </p>
                    <p className="text-xs text-slate-500">{m.aiReasoning}</p>
                  </div>
                </div>
                <Link
                  href={`/freelancers/${m.freelancerId}` as Route}
                  className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  View
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="neutral">Skills {Math.round(m.skillMatch)}</Badge>
                <Badge variant="neutral">Rate {Math.round(m.rateMatch)}</Badge>
                <Badge variant="neutral">Experience {Math.round(m.experienceMatch)}</Badge>
                <Badge variant="neutral">Availability {Math.round(m.availabilityMatch)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
