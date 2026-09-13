/**
 * BridgeofTalent seed script.
 *
 * Creates demo client & freelancer accounts and a handful of open jobs so the
 * app has something to click through. Idempotent: re-running updates existing
 * rows instead of duplicating them.
 *
 * Usage:
 *   npm run db:seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
 * the environment, or from .env.local / .env in the project root).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_PASSWORD = 'Passw0rd!demo';

const clients = [
  { email: 'client@bridgeoftalent.demo', name: 'Nadia Okoro', company: 'Northwind Labs' },
  { email: 'founder@bridgeoftalent.demo', name: 'Tomas Berg', company: 'Berg Studio' },
];

const freelancers = [
  {
    email: 'dev@bridgeoftalent.demo',
    name: 'Ada Chen',
    title: 'Senior Full-Stack Engineer',
    location: 'Remote (UTC+1)',
    hourly_rate: 85,
    bio: 'Full-stack engineer specialising in React, Next.js and Node with 8 years shipping SaaS products.',
    skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL'],
  },
  {
    email: 'designer@bridgeoftalent.demo',
    name: 'Priya Nair',
    title: 'Product Designer',
    location: 'Remote (UTC+5:30)',
    hourly_rate: 70,
    bio: 'Product designer focused on clean, accessible interfaces and design systems.',
    skills: ['Figma', 'UI Design', 'Design Systems', 'Prototyping'],
  },
  {
    email: 'data@bridgeoftalent.demo',
    name: 'Marcus Reed',
    title: 'Data & ML Engineer',
    location: 'Remote (UTC-5)',
    hourly_rate: 95,
    bio: 'Data engineer building pipelines and ML features; comfortable across Python, SQL and cloud.',
    skills: ['Python', 'SQL', 'Machine Learning', 'Airflow'],
  },
];

// Fixed IDs so re-seeding upserts rather than duplicating.
const jobs = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    client: 'client@bridgeoftalent.demo',
    title: 'Build a Next.js dashboard for a fintech product',
    description:
      'We need a responsive analytics dashboard in Next.js + TypeScript, integrating our REST API and charting library. Auth is already handled.',
    category: 'Web Development',
    location: 'Remote',
    budget_type: 'fixed' as const,
    budget_min: 4000,
    budget_max: 8000,
    skills: ['React', 'Next.js', 'TypeScript'],
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    client: 'client@bridgeoftalent.demo',
    title: 'Design system refresh for a B2B SaaS',
    description:
      'Audit our current UI and deliver a refreshed design system in Figma: colour, type, components and usage docs.',
    category: 'Design',
    location: 'Remote',
    budget_type: 'fixed' as const,
    budget_min: 3000,
    budget_max: 6000,
    skills: ['Figma', 'Design Systems', 'UI Design'],
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    client: 'founder@bridgeoftalent.demo',
    title: 'Set up an analytics data pipeline',
    description:
      'Design and implement an ELT pipeline pulling from Postgres and Stripe into a warehouse, with daily refresh and basic dbt models.',
    category: 'Data',
    location: 'Remote',
    budget_type: 'hourly' as const,
    budget_min: 60,
    budget_max: 100,
    skills: ['Python', 'SQL', 'Airflow'],
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    client: 'founder@bridgeoftalent.demo',
    title: 'Landing page build from Figma',
    description:
      'Convert an existing Figma landing page into a fast, accessible marketing site. Static content, no CMS required.',
    category: 'Web Development',
    location: 'Remote',
    budget_type: 'fixed' as const,
    budget_min: 1500,
    budget_max: 3000,
    skills: ['HTML', 'CSS', 'React'],
  },
];

async function ensureUser(email: string, name: string, role: 'client' | 'freelancer'): Promise<string> {
  const created = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (created.data?.user) return created.data.user.id;

  // Already exists — find the existing user id.
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list.data?.users.find((u) => u.email === email);
  if (found) return found.id;

  throw created.error ?? new Error(`Could not create or find user ${email}`);
}

async function main() {
  console.log('Seeding BridgeofTalent demo data…');
  const idByEmail = new Map<string, string>();

  for (const c of clients) {
    const id = await ensureUser(c.email, c.name, 'client');
    idByEmail.set(c.email, id);
    await supabase.from('profiles').update({ company: c.company, name: c.name }).eq('id', id);
    console.log(`  client   ${c.email}`);
  }

  for (const f of freelancers) {
    const id = await ensureUser(f.email, f.name, 'freelancer');
    idByEmail.set(f.email, id);
    await supabase.from('profiles').update({ name: f.name }).eq('id', id);
    await supabase
      .from('freelancers')
      .update({
        title: f.title,
        location: f.location,
        hourly_rate: f.hourly_rate,
        bio: f.bio,
        skills: f.skills,
        availability_status: 'available',
      })
      .eq('id', id);
    console.log(`  freelancer ${f.email}`);
  }

  for (const j of jobs) {
    const clientId = idByEmail.get(j.client);
    if (!clientId) continue;
    const clientName = clients.find((c) => c.email === j.client)?.name ?? 'Client';
    const { error } = await supabase.from('jobs').upsert(
      {
        id: j.id,
        client_id: clientId,
        client_name: clientName,
        title: j.title,
        description: j.description,
        category: j.category,
        location: j.location,
        budget_type: j.budget_type,
        budget_min: j.budget_min,
        budget_max: j.budget_max,
        skills: j.skills,
        status: 'open',
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    console.log(`  job      ${j.title}`);
  }

  console.log(`\nDone. Demo login password for all seed accounts: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
