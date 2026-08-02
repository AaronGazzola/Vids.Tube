import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type Membership = { id: string; channel_id: string; lifetime_xp: number; credits: number };
type Entry = { membership_id: string; amount: number; kind: string };

async function page<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin
      .from(table as "memberships")
      .select(cols)
      .range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < size) break;
  }
  return out;
}

const expectedEarned = (xp: number) => Math.max(Math.floor((xp ?? 0) / 10), 0);

async function main() {
  const memberships = await page<Membership>("memberships", "id,channel_id,lifetime_xp,credits");
  const entries = await page<Entry>("credit_entries", "membership_id,amount,kind");

  const byMembership = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = byMembership.get(e.membership_id);
    if (list) list.push(e);
    else byMembership.set(e.membership_id, [e]);
  }

  const failures: string[] = [];
  let totalEarned = 0;
  let totalSpent = 0;
  let withSpends = 0;

  for (const m of memberships) {
    const lines = byMembership.get(m.id) ?? [];
    const earnedLines = lines.filter((l) => l.kind === "earned");
    const spendLines = lines.filter((l) => l.kind !== "earned");
    const sum = lines.reduce((a, l) => a + l.amount, 0);

    if (earnedLines.length > 1) {
      failures.push(`${m.id}: ${earnedLines.length} earning lines, expected at most 1`);
    }
    if (earnedLines.length === 0) {
      failures.push(`${m.id}: no earning line`);
    } else if (earnedLines[0].amount !== expectedEarned(m.lifetime_xp)) {
      failures.push(
        `${m.id}: earning line ${earnedLines[0].amount} but ${m.lifetime_xp} XP should give ${expectedEarned(m.lifetime_xp)}`
      );
    }
    if (m.credits !== sum) {
      failures.push(`${m.id}: cached credits ${m.credits} but ledger sums to ${sum}`);
    }
    if (spendLines.some((l) => l.amount >= 0)) {
      failures.push(`${m.id}: a non-earning line has a non-negative amount`);
    }

    totalEarned += earnedLines.reduce((a, l) => a + l.amount, 0);
    totalSpent += spendLines.reduce((a, l) => a + l.amount, 0);
    if (spendLines.length) withSpends += 1;
  }

  const memberIds = new Set(memberships.map((m) => m.id));
  const orphans = entries.filter((e) => !memberIds.has(e.membership_id));
  if (orphans.length) failures.push(`${orphans.length} ledger lines point at no membership`);

  console.log(`memberships: ${memberships.length}`);
  console.log(`ledger lines: ${entries.length}`);
  console.log(`total earned: ${totalEarned}`);
  console.log(`total spent: ${totalSpent}`);
  console.log(`memberships with spends: ${withSpends}`);
  console.log(`memberships with credits above zero: ${memberships.filter((m) => m.credits > 0).length}`);

  if (failures.length) {
    console.error(`\n${failures.length} failures:`);
    for (const f of failures.slice(0, 30)) console.error(`  ${f}`);
    if (failures.length > 30) console.error(`  ...and ${failures.length - 30} more`);
    process.exit(1);
  }
  console.log("\nledger is consistent: one earning line per membership, every cached balance matches");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
