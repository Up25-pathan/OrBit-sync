import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing & Plans | Free & Developer Pro',
  description:
    'Explore OrBit plans. Free for open-source developers with unlimited local-mesh peer connections. Upgrade to Developer Pro or Team Mesh for enterprise dead-drop vaults and priority signaling relays.',
  alternates: {
    canonical: 'https://orbit-sync.dev/pricing',
  },
  openGraph: {
    title: 'OrBit Pricing | Transparent Plans for Developers & Teams',
    description:
      'Transparent developer pricing for sub-millisecond local-first workspace synchronization and encrypted dead-drop vaults.',
    url: 'https://orbit-sync.dev/pricing',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
