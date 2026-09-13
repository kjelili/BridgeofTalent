'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title, amount: Number(amount) || 0 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not add milestone.');
        return;
      }
      setTitle('');
      setAmount('');
      router.refresh();
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <Label htmlFor="ms-title">Milestone</Label>
        <Input
          id="ms-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Design phase"
        />
      </div>
      <div className="w-32">
        <Label htmlFor="ms-amount">Amount ($)</Label>
        <Input
          id="ms-amount"
          type="number"
          min={0}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Adding…' : 'Add milestone'}
      </Button>
      {error && <p className="w-full text-sm text-error">{error}</p>}
    </form>
  );
}
