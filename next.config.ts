import type { NextConfig } from "next";

const CSP_ENFORCE = true;
const isDev = process.env.NODE_ENV !== "production";

function originOf(url: string | undefined): string {
  if (!url) {
    return "";
  }
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function directive(name: string, ...tokens: string[]): string {
  return `${name} ${tokens.filter(Boolean).join(" ")}`.trim();
}

const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");
const vodBase = originOf(process.env.NEXT_PUBLIC_VOD_BASE_URL);
const streamHost = originOf(process.env.NEXT_PUBLIC_STREAM_HOST);
// Only the ORIGIN of the game address enters the policy; the rest of that value is a path and a hash
// carrying the rig and its configuration, which have no business in a header.
const gameOrigin = originOf(process.env.NEXT_PUBLIC_GAME_EMBED_URL);
const imageCdns = ["https://picsum.photos", "https://fastly.picsum.photos"];
const youtubeAvatarHosts = [
  "https://*.ggpht.com",
  "https://*.googleusercontent.com",
];

const contentSecurityPolicy = [
  directive("default-src", "'self'"),
  directive(
    "script-src",
    "'self'",
    "'unsafe-inline'",
    isDev ? "'unsafe-eval'" : ""
  ),
  directive("style-src", "'self'", "'unsafe-inline'"),
  directive(
    "img-src",
    "'self'",
    "data:",
    "blob:",
    supabaseOrigin,
    vodBase,
    ...imageCdns,
    ...youtubeAvatarHosts
  ),
  directive("media-src", "'self'", "blob:", streamHost, vodBase, supabaseOrigin),
  directive(
    "connect-src",
    "'self'",
    supabaseOrigin,
    supabaseWs,
    streamHost,
    vodBase
  ),
  directive("font-src", "'self'"),
  // Never omitted: an absent frame-src inherits default-src 'self', which blocks the game window with no
  // directive naming the cause. This says what is permitted, or says nothing is.
  directive("frame-src", gameOrigin || "'none'"),
  directive("frame-ancestors", "'none'"),
  directive("base-uri", "'self'"),
  directive("form-action", "'self'"),
  directive("object-src", "'none'"),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: CSP_ENFORCE
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
