'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase-browser';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [skills, setSkills] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in?redirect=/profile' as Route);
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
      const { data: freelancer } = await supabase
        .from('freelancers')
        .select('title, bio, location, hourly_rate, skills')
        .eq('id', user.id)
        .maybeSingle();
      if (!active) return;
      setName(profile?.name || '');
      setTitle(freelancer?.title || '');
      setBio(freelancer?.bio || '');
      setLocation(freelancer?.location || '');
      setHourlyRate(freelancer?.hourly_rate != null ? String(freelancer.hourly_rate) : '');
      setSkills((freelancer?.skills || []).join(', '));
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch('/api/freelancer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          title,
          bio,
          location,
          hourlyRate: Number(hourlyRate) || 0,
          skills: skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not save your profile.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Your freelancer profile</CardTitle>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <p className="text-slate-500">Loading…</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="title">Professional title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Senior Full-Stack Engineer"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={5}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell clients about your experience and what you do best…"
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Remote (UTC+1)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hourlyRate">Hourly rate ($)</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      min={0}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="85"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="skills">Skills (comma separated)</Label>
                  <Input
                    id="skills"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="React, TypeScript, Node.js"
                  />
                </div>
                {error && <p className="text-sm text-error">{error}</p>}
                {saved && <p className="text-sm text-success">Profile saved.</p>}
                <Button type="submit" size="lg" disabled={saving}>
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
