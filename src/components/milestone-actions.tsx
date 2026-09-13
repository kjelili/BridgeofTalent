'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface Props {
  projectId: string;
  milestoneId: string;
  amount: number;
  escrowId: string | null;
  escrowStatus: string | null;
}

export function MilestoneActions({ projectId, milestoneId, amount, escrowId, escrowStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fund() {
    setError(null);
    setLoading('fund');
    try {
      const res = await fetch('/api/escrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, milestoneId, amount }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not fund milestone.');
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(null);
    }
  }

  async function release(action: 'release' | 'dispute') {
    if (!escrowId) return;
    setError(null);
    setLoading(action);
    try {
      const res = await fetch('/api/escrow', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escrowId, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Action failed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(null);
    }
  }

  const funded = escrowStatus === 'held' || escrowStatus === 'pending';

  return (
    <div className="flex flex-col items-end gap-1">
      {!escrowId && (
        <Button size="sm" onClick={fund} disabled={loading !== null}>
          {loading === 'fund' ? 'Funding…' : `Fund ${formatCurrency(amount)}`}
        </Button>
      )}
      {funded && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => release('release')} disabled={loading !== null}>
            {loading === 'release' ? 'Releasing…' : 'Release'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => release('dispute')}
            disabled={loading !== null}
          >
            Dispute
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
