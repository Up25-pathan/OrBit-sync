import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer Login',
  description: 'Authenticate your developer credentials to manage OrBit workspace licenses and node configurations.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
