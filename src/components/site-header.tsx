import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-bold text-white">
            B
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">BridgeofTalent</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <Link href="/jobs" className="hover:text-slate-900">
            Browse jobs
          </Link>
          <Link href="/post-job" className="hover:text-slate-900">
            Post a job
          </Link>
          <Link href="/dashboard" className="hover:text-slate-900">
            Dashboard
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="hidden text-sm font-semibold text-slate-700 hover:text-slate-900 sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
