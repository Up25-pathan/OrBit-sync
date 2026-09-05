import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download OrBit | Windows, macOS & Linux',
  description:
    'Download the official OrBit desktop client, background Rust synchronization daemon, and VS Code extension for instantaneous workspace mesh synchronization.',
  alternates: {
    canonical: 'https://orbit-sync.dev/download',
  },
  openGraph: {
    title: 'Download OrBit Desktop & Daemon',
    description:
      'Get started with OrBit on Windows, macOS, Linux, and VS Code. Lightweight, memory-efficient, and blazing fast.',
    url: 'https://orbit-sync.dev/download',
  },
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
