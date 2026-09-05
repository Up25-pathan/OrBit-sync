import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer Console',
  description: 'Manage OrBit node keys, license allocations, and subscription telemetry.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
