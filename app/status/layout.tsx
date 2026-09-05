import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Network & System Status',
  description:
    'Live real-time status of the OrBit global signaling network, dead-drop storage nodes, authentication endpoints, and peer discovery relays.',
  alternates: {
    canonical: 'https://orbit-sync.dev/status',
  },
  openGraph: {
    title: 'OrBit Live System & Network Status',
    description:
      'Real-time operational status, relay latency, and uptime reports across the OrBit mesh network.',
    url: 'https://orbit-sync.dev/status',
  },
};

export default function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
