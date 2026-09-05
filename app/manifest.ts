import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OrBit Workspace Synchronization Engine',
    short_name: 'OrBit',
    description:
      'Sub-millisecond local-first workspace synchronization engine across VS Code, Tauri desktop frames, and background Rust daemons.',
    start_url: '/',
    display: 'standalone',
    background_color: '#030303',
    theme_color: '#030303',
    icons: [
      {
        src: '/logo.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
