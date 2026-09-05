import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Global Telemetry & Performance Benchmarks',
  description:
    'Real-time synchronization benchmarks, memory allocations, CPU utilization, and peer-to-peer latency metrics for OrBit nodes worldwide.',
  alternates: {
    canonical: 'https://orbit-sync.dev/telemetry',
  },
  openGraph: {
    title: 'OrBit Telemetry & Performance Benchmarks',
    description:
      'Live throughput, memory footprints, and peer-to-peer synchronization latency benchmarks.',
    url: 'https://orbit-sync.dev/telemetry',
  },
};

export default function TelemetryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
