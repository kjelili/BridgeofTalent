import Link from 'next/link';

const features = [
  {
    title: 'AI-powered matching',
    body: 'Our matching engine scores every freelancer against your job on skills, rate, experience and availability — so the best fits rise to the top instantly.',
  },
  {
    title: 'Vetted, verified talent',
    body: 'Identity checks, skill tests and job-success scoring mean you work with professionals you can trust from day one.',
  },
  {
    title: 'Secure escrow payments',
    body: 'Funds are held safely in escrow and released on approved milestones. A flat 5% platform fee — no surprises.',
  },
  {
    title: 'Smart proposals',
    body: 'Freelancers generate tailored, professional proposals in seconds, so you get higher-quality bids with less back-and-forth.',
  },
];

const steps = [
  { n: '01', title: 'Post your job', body: 'Describe the work, budget and skills. It takes a couple of minutes.' },
  { n: '02', title: 'Get matched', body: 'Receive a ranked shortlist of vetted freelancers within minutes.' },
  { n: '03', title: 'Hire & pay safely', body: 'Fund milestones into escrow and release payment when you approve the work.' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-bold text-white">
              B
            </span>
            <span className="text-lg font-bold tracking-tight">BridgeofTalent</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#how" className="hover:text-slate-900">How it works</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="#" className="hidden text-sm font-semibold text-slate-700 hover:text-slate-900 sm:block">
              Sign in
            </a>
            <a
              href="#get-started"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              Get started
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 to-white" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <span className="h-2 w-2 rounded-full bg-accent-500" />
            AI-powered freelance marketplace
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Hire vetted freelancers,{' '}
            <span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">
              faster
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            BridgeofTalent matches you with the right talent using AI, keeps your money safe in
            escrow, and turns hiring from weeks into minutes.
          </p>
          <div id="get-started" className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#"
              className="w-full rounded-lg bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-brand-600 sm:w-auto"
            >
              Post a job
            </a>
            <a
              href="#"
              className="w-full rounded-lg border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              Find work
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500">No credit card required · Flat 5% platform fee</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Everything you need to hire with confidence</h2>
          <p className="mt-4 text-slate-600">Built for clients and freelancers who value speed, quality and trust.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-3 text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">How it works</h2>
            <p className="mt-4 text-slate-600">Three simple steps from job post to hire.</p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-16 text-center shadow-xl">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to build your team?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-100">
            Join BridgeofTalent today. Post a job for free and only pay a flat 5% when you hire.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#"
              className="w-full rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-700 shadow-md transition hover:bg-brand-50 sm:w-auto"
            >
              Get started free
            </a>
            <a
              href="#features"
              className="w-full rounded-lg border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-500 text-xs font-bold text-white">
              B
            </span>
            <span className="font-semibold text-slate-700">BridgeofTalent</span>
          </div>
          <p>© {new Date().getFullYear()} BridgeofTalent. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/api/search" className="hover:text-slate-700">API</Link>
            <a href="#" className="hover:text-slate-700">Privacy</a>
            <a href="#" className="hover:text-slate-700">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
