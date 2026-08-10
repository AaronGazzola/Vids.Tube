const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function isLoopbackAddress(ip: string | null | undefined): boolean {
  if (!ip) return false;

  let bare = ip.trim();
  if (bare.startsWith("[")) {
    const close = bare.indexOf("]");
    if (close === -1) return false;
    bare = bare.slice(1, close);
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(bare)) {
    bare = bare.slice(0, bare.lastIndexOf(":"));
  }

  return LOOPBACK_ADDRESSES.has(bare);
}
