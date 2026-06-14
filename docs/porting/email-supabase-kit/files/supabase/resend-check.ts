const KEY = process.env.RESEND_API_KEY;

async function main() {
  if (!KEY) {
    console.error(
      "Missing RESEND_API_KEY (add it to Doppler dev_personal and run via `doppler run -- ...`)."
    );
    process.exit(1);
  }

  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${KEY}` },
  });

  if (res.status === 401 || res.status === 403) {
    console.error(
      `Resend rejected the key for domain access (${res.status}). This is likely a sending-only key; domain management needs a full-access key.`
    );
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`GET /domains failed: ${res.status}\n${await res.text()}`);
    process.exit(1);
  }

  const body = (await res.json()) as {
    data?: Array<{ name: string; status: string; region: string }>;
  };
  const domains = body.data ?? [];

  if (domains.length === 0) {
    console.error("No domains in this Resend account. Add and verify one to send from it.");
    return;
  }

  console.error("Resend domains:");
  for (const d of domains) {
    const ok = d.status === "verified";
    console.error(`  [${ok ? "VERIFIED" : d.status.toUpperCase()}] ${d.name} (${d.region})`);
  }
  console.error(
    "\nThe auth from-address (smtp_admin_email) must use a VERIFIED domain above, or Resend rejects the send."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
