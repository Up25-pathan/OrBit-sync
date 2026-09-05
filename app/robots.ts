import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/download',
          '/docs',
          '/pricing',
          '/security',
          '/about',
          '/status',
          '/telemetry',
          '/contact',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/console/',
          '/console/*',
          '/admin/',
          '/admin/*',
          '/checkout/',
          '/checkout/*',
          '/api/',
          '/api/*',
        ],
      },
    ],
    sitemap: 'https://orbit-sync.dev/sitemap.xml',
    host: 'https://orbit-sync.dev',
  };
}
