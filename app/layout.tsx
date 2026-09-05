import type { Metadata, Viewport } from "next";
import { Orbitron, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/footer/Footer";
import JsonLd from "@/components/seo/JsonLd";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const viewport: Viewport = {
  themeColor: "#030303",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://orbit-sync.dev"),
  title: {
    default: "OrBit | Local-First Workspace Synchronization Engine",
    template: "%s | OrBit Sync",
  },
  description:
    "Synchronize local workspaces across VS Code, Tauri desktop frames, and background Rust daemons at sub-millisecond latencies. Zero-knowledge encryption, P2P mesh network, and dead-drop vaults.",
  keywords: [
    "OrBit",
    "OrBit Sync",
    "workspace synchronization",
    "local-first software",
    "peer-to-peer sync",
    "Rust daemon",
    "VS Code live share alternative",
    "zero-knowledge encryption",
    "distributed file system",
    "dead-drop vault",
    "developer collaboration",
    "real-time code sync",
  ],
  authors: [{ name: "OrBit Core Network", url: "https://orbit-sync.dev" }],
  creator: "OrBit Network",
  publisher: "OrBit Network",
  applicationName: "OrBit",
  alternates: {
    canonical: "https://orbit-sync.dev",
    languages: {
      "en-US": "https://orbit-sync.dev",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://orbit-sync.dev",
    siteName: "OrBit Sync",
    title: "OrBit | Local-First Workspace Synchronization Engine",
    description:
      "Sub-millisecond local-first workspace synchronization engine. Zero-knowledge P2P mesh and background Rust daemons.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OrBit - Local-First Workspace Synchronization Engine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OrBit | Local-First Workspace Synchronization Engine",
    description:
      "Sub-millisecond local-first workspace synchronization engine. Zero-knowledge P2P mesh and background Rust daemons.",
    creator: "@orbitsync",
    site: "@orbitsync",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <JsonLd />
      </head>
      <body className={`${orbitron.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
