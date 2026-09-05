import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy & Zero-Telemetry Guarantee',
  description:
    'OrBit Privacy Policy. We adhere to local-first principles: zero-telemetry, client-side encryption, and zero storage of your source code.',
  alternates: {
    canonical: 'https://orbit-sync.dev/privacy',
  },
  openGraph: {
    title: 'OrBit Privacy Policy | Local-First & Zero-Knowledge',
    description:
      'Our strict commitment to developer privacy, zero telemetry, and client-side encryption.',
    url: 'https://orbit-sync.dev/privacy',
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
