import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service & Licensing',
  description:
    'Terms of Service and software licensing conditions for OrBit synchronization clients, relay servers, and developer services.',
  alternates: {
    canonical: 'https://orbit-sync.dev/terms',
  },
  openGraph: {
    title: 'OrBit Terms of Service',
    description:
      'Terms of service, usage guidelines, and software licensing for the OrBit ecosystem.',
    url: 'https://orbit-sync.dev/terms',
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
