const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ??
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ??
  "cqblezzhywdjerslhgho";

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

function token(): string {
  const t = process.env.SUPABASE_ACCESS_TOKEN;
  if (!t) {
    console.error(
      "Missing SUPABASE_ACCESS_TOKEN (run via `doppler run -- ...`). Create one at https://supabase.com/dashboard/account/tokens"
    );
    process.exit(1);
  }
  return t;
}

export { PROJECT_REF };

export async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  return { status: res.status, ok: res.ok, body: await res.json().catch(() => null) };
}

export async function getAuthConfig(): Promise<Record<string, unknown>> {
  const r = await apiGet("/config/auth");
  if (!r.ok) throw new Error(`GET config/auth failed: ${r.status}`);
  return r.body as Record<string, unknown>;
}

export async function patchAuthConfig(body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PATCH config/auth failed: ${res.status}\n${await res.text()}`);
  }
}
