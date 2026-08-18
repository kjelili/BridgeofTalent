import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BridgeofTalent — Hire vetted freelancers, faster',
  description:
    'BridgeofTalent is an AI-powered marketplace that matches clients with vetted freelancers, with secure escrow payments and smart proposals.',
  metadataBase: new URL('https://www.bridgeoftalent.com'),
  openGraph: {
    title: 'BridgeofTalent — Hire vetted freelancers, faster',
    description:
      'AI-powered matching, vetted talent, and secure escrow payments — all in one platform.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
