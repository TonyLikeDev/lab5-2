import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Partial Prerendering (PPR) is only available on next@canary.
  // To enable: run `npm install next@canary` then uncomment below
  // and the `export const experimental_ppr = true;` line in
  // app/dashboard/layout.tsx.
  // experimental: { ppr: 'incremental' },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
    ],
  },
};

export default nextConfig;
