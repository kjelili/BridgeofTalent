import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-white">
            B
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">BridgeofTalent</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
