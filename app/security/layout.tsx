import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zero-Knowledge Security & Architecture',
  description:
    'Deep dive into OrBit cryptographic security guarantees: Noise Protocol Framework, ChaCha20-Poly1305 authenticated encryption, ephemeral session keys, and local-first data custody.',
  alternates: {
    canonical: 'https://orbit-sync.dev/security',
  },
  openGraph: {
    title: 'OrBit Zero-Knowledge Cryptography & Security',
    description:
      'Zero-knowledge encryption, Noise Protocol handshakes, and verifiable end-to-end security architecture.',
    url: 'https://orbit-sync.dev/security',
  },
};

export default function SecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
