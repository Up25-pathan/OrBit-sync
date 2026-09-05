import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Developer Account',
  description: 'Create an OrBit developer account to provision cryptographic node keys, dead-drop vaults, and team licenses.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
