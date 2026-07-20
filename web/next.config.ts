import type { NextConfig } from "next";
import path from "path";

const isCapacitor = process.env.CAPACITOR_BUILD === 'true';
const API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.vigilantitsolution.com';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextConfig: NextConfig & Record<string, any> = {
  compiler: {
    styledComponents: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  ...(isCapacitor ? {
    output: 'export',
    images: { unoptimized: true }
  } : {}),
  // SOVEREIGN API PROXY: /api/* -> backend, fixes SSL cert issues for cinema vault
  ...(!isCapacitor ? {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: API_URL.endsWith('/api') ? `${API_URL}/:path*` : `${API_URL}/api/:path*`,
        },
      ];
    }
  } : {}),
};

if (!isCapacitor) {
  // @ts-ignore
  nextConfig.headers = async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' 'unsafe-eval' 'unsafe-inline' https://vigilantitsolution.com https://miracle.vigilantitsolution.com https://demo.vigilantitsolution.com https://www.googletagmanager.com; " +
                   "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vigilantitsolution.com https://miracle.vigilantitsolution.com https://demo.vigilantitsolution.com https://www.googletagmanager.com https://cdn.jsdelivr.net; " +
                   "connect-src 'self' https://miracle.vigilantitsolution.com wss://miracle.vigilantitsolution.com https://api.vigilantitsolution.com wss://api.vigilantitsolution.com https://vigilantitsolution.com https://demo.vigilantitsolution.com http://127.0.0.1:8090 ws://127.0.0.1:8090 http://localhost:8090 ws://localhost:8090 http://127.0.0.1:8095 ws://127.0.0.1:8095 http://localhost:8095 ws://localhost:8095 https://www.google-analytics.com https://www.google.com https://cdn.jsdelivr.net https://api.open-meteo.com https://api.frankfurter.dev; " +
                   "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com; " +
                   "media-src 'self' blob: https: http:; " +
                   "img-src 'self' data: https: blob:; " +
                   "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                   "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com data:; " +
                   "worker-src 'self' blob:;"
          },
        ],
      },
    ];
  };
}

export default nextConfig;

