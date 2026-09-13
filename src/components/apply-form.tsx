'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function ApplyForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [timeline, setTimeline] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          amount: Number(amount) || 0,
          timeline,
          message,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not submit your application.');
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
        Your application has been submitted. The client can now review your proposal.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="amount">Your rate / bid ($)</Label>
          <Input
            id="amount"
            type="number"
            min={0}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1500"
          />
        </div>
        <div>
          <Label htmlFor="timeline">Timeline</Label>
          <Input
            id="timeline"
            required
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            placeholder="2–3 weeks"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="message">Cover message</Label>
        <Textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Explain why you're a great fit for this job…"
        />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <Button type="submit" size="lg" disabled={loading}>
        {loading ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  );
}
