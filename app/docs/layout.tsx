import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation & API Reference',
  description:
    'Comprehensive technical documentation for OrBit. Learn about the P2P Mesh protocol, Rust daemon configuration, Dead-Drop Vault API, and CLI commands.',
  alternates: {
    canonical: 'https://orbit-sync.dev/docs',
  },
  openGraph: {
    title: 'OrBit Documentation | Protocol, CLI & Architecture',
    description:
      'Developer guides, CLI reference, and architecture specs for local-first peer-to-peer workspace synchronization.',
    url: 'https://orbit-sync.dev/docs',
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
