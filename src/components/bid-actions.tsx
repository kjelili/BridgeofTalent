'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function BidActions({ bidId }: { bidId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'accept' | 'reject') {
    setError(null);
    setLoading(action);
    try {
      const res = await fetch('/api/bids', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, action }),
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

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => act('accept')} disabled={loading !== null}>
          {loading === 'accept' ? 'Accepting…' : 'Accept'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => act('reject')} disabled={loading !== null}>
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
