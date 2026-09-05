import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Secure License Checkout',
  description: 'Complete your OrBit Pro or Team subscription securely.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
