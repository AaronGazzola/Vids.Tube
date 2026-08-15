// Every overlay endpoint is called by a framed document on another origin, so
// without these the browser refuses the request before it is sent. The origin
// allowed is the same build-time one the framing policy names, so exactly what
// may be framed may call these, and nothing else.
export function overlayCorsHeaders(): Record<string, string> {
  const configured = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  if (!configured) {
    return {};
  }
  try {
    return {
      "Access-Control-Allow-Origin": new URL(configured).origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  } catch {
    return {};
  }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer (.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
