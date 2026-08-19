'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type BudgetType = 'fixed' | 'hourly';

export default function PostJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('Remote');
  const [budgetType, setBudgetType] = useState<BudgetType>('fixed');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [skills, setSkills] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          location,
          budgetType,
          budgetMin: Number(budgetMin) || 0,
          budgetMax: Number(budgetMax) || 0,
          skills: skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not post job.');
        return;
      }
      router.push(`/jobs/${json.id}` as Route);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Post a job</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="title">Job title</Label>
                <Input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Senior React Developer for fintech dashboard"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  required
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the project, deliverables and requirements…"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Web Development"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Remote"
                  />
                </div>
              </div>

              <div>
                <Label>Budget type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['fixed', 'hourly'] as BudgetType[]).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setBudgetType(t)}
                      className={cn(
                        'rounded-lg border px-4 py-2.5 text-sm font-semibold capitalize transition',
                        budgetType === t
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="budgetMin">Budget min ($)</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    min={0}
                    required
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="500"
                  />
                </div>
                <div>
                  <Label htmlFor="budgetMax">Budget max ($)</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    min={0}
                    required
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="2500"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="skills">Skills (comma separated)</Label>
                <Input
                  id="skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, TypeScript, Tailwind"
                />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Posting…' : 'Post job'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
