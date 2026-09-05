import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Engineering & Support',
  description:
    'Get in touch with the OrBit core engineering team for enterprise inquiries, mesh relay deployment assistance, or developer support.',
  alternates: {
    canonical: 'https://orbit-sync.dev/contact',
  },
  openGraph: {
    title: 'Contact OrBit Engineering & Developer Support',
    description:
      'Have questions about enterprise P2P deployments or need technical support? Contact the OrBit team directly.',
    url: 'https://orbit-sync.dev/contact',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
