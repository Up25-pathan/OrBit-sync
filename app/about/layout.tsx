import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About OrBit | The Local-First Workspace Engine',
  description:
    'Learn why OrBit was engineered: Eliminating cloud vendor lock-in with decentralized peer-to-peer developer workspace synchronization powered by Rust and Go.',
  alternates: {
    canonical: 'https://orbit-sync.dev/about',
  },
  openGraph: {
    title: 'About OrBit | Built for Developers by Developers',
    description:
      'The mission behind OrBit: Sub-millisecond, local-first code synchronization without third-party surveillance.',
    url: 'https://orbit-sync.dev/about',
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
