import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChainChit — Reverse Auction Bidding & Statistical Fraud Detection Engine',
  description: 'A permissioned chit fund platform featuring in-line Z-Score underbid analysis, collusion detection, and tamper-evident audit logging.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
