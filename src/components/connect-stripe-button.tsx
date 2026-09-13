'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ConnectStripeButton({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || 'Could not start onboarding.');
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={connect} disabled={loading}>
        {loading ? 'Redirecting…' : connected ? 'Update payout details' : 'Connect with Stripe'}
      </Button>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
