// ============================================================================
  // عافيتك (Aafiatak) Healthcare Platform - Next.js Configuration
  // ============================================================================
  // Production-ready configuration with security headers, image optimization,
  // and Vercel deployment settings.
  // ============================================================================

  import type { NextConfig } from "next";

  // ============================================================================
  // Security Headers (defined inline to avoid import issues during build)
  // ============================================================================

  const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self)",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: ws: wss: blob:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  };

  // ============================================================================
  // Next.js Configuration
  // ============================================================================

  const nextConfig: NextConfig = {
    typescript: {
      ignoreBuildErrors: true,
    },

    // DISABLE strict mode in production — prevents double-rendering which
    // causes visible flickering and slower perceived performance
    reactStrictMode: false,

    // Remove X-Powered-By header (minor security hardening)
    poweredByHeader: false,

    // Enable gzip/brotli compression for all responses (~30-60% smaller bundles)
    compress: true,

    // ============================================================================
    // Performance: Output standalone build for smaller serverless functions
    // ============================================================================
    output: 'standalone',

    // ============================================================================
    // Image Optimization
    // ============================================================================

    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "**.aafiatak.com",
        },
        {
          protocol: "https",
          hostname: "firebasestorage.googleapis.com",
        },
        {
          protocol: "https",
          hostname: "storage.googleapis.com",
        },
        {
          protocol: "https",
          hostname: "lh3.googleusercontent.com",
        },
        {
          protocol: "https",
          hostname: "res.cloudinary.com",
        },
      ],
      formats: ["image/avif", "image/webp"],
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      minimumCacheTTL: 60,
    },

    // ============================================================================
    // Server External Packages
    // Keep heavy server-only packages out of the serverless function bundle.
    // ============================================================================

    serverExternalPackages: [
      "mongoose",
      "bcryptjs",
      "jsonwebtoken",
      "nodemailer",
      "socket.io",
      "web-push",
      "jszip",
    ],

    // ============================================================================
    // Security Headers (applied to all routes)
    // ============================================================================

    async headers() {
      return [
        {
          source: "/(.*)",
          headers: Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
            key,
            value,
          })),
        },
        {
          source: "/(.*)\.(js|css|woff|woff2|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp|avif)",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
        {
          source: "/api/(.*)",
          headers: [
            {
              key: "Cache-Control",
              value: "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
          ],
        },
      ];
    },

    // ============================================================================
    // Experimental Features
    // ============================================================================

    // Turbopack root — silence the workspace root warning
    turbopack: {
      root: '..',
    },

    experimental: {
      optimizePackageImports: [
        // UI Icons — very large without tree-shaking
        "lucide-react",
        // Charts — used in admin dashboard
        "recharts",
        // Date utilities
        "date-fns",
        // Animation — large without optimization
        "framer-motion",
        // Maps — SSR-excluded but still benefits from optimized imports
        "react-leaflet",
        // Forms
        "react-hook-form",
        // Data fetching
        "@tanstack/react-query",
        // Drag and drop — admin deployments/scheduling UI
        "@dnd-kit/core",
        "@dnd-kit/sortable",
        "@dnd-kit/utilities",
        // Tables — admin data tables
        "@tanstack/react-table",
        // Radix UI primitives
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-select",
        "@radix-ui/react-tabs",
        "@radix-ui/react-toast",
        "@radix-ui/react-popover",
        "@radix-ui/react-accordion",
        "@radix-ui/react-avatar",
        // ADDITIONAL: More packages that benefit from tree-shaking
        "@radix-ui/react-tooltip",
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-switch",
        "@radix-ui/react-slider",
        "@radix-ui/react-separator",
        "@radix-ui/react-scroll-area",
        "@radix-ui/react-collapsible",
        "class-variance-authority",
        "cmdk",
        "sonner",
        "zod",
        "jose",
      ],
    },
  };

  export default nextConfig;
