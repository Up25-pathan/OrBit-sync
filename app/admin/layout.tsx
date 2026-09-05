import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Control Center & System Administration',
  description: 'OrBit administrator panel for node telemetry, system health, and license management.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
