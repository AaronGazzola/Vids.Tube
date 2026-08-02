// Verifies the credit ledger against the remote database. Every case seeds real
// rows inside a transaction and ROLLS BACK, so nothing is ever committed and no
// probe channel is ever publicly visible.
//
// Needs SUPABASE_ACCESS_TOKEN (Management API):
//   doppler run -c dev_personal -- npm run verify:credit-merge
import { PROJECT_REF } from "../supabase/config-api";

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

async function query(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${API}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`query failed ${res.status}: ${JSON.stringify(body)}`);
  }
  return Array.isArray(body) ? (body as Record<string, unknown>[]) : [];
}

const COMMUNITY = "11111111-1111-4111-8111-111111111111";
const SURVIVOR = "22222222-2222-4222-8222-222222222222";
const LOSER = "33333333-3333-4333-8333-333333333333";
const M_SURVIVOR = "44444444-4444-4444-8444-444444444444";
const M_LOSER = "55555555-5555-4555-8555-555555555555";

const SEED = `
insert into public.channels (id, slug, handle, name, youtube_channel_id)
values ('${COMMUNITY}', 'probe_community', 'probe_community', 'Probe community', 'UC_PROBE_COMMUNITY'),
       ('${SURVIVOR}', 'probe_survivor', 'probe_survivor', 'Probe survivor', 'UC_PROBE_SURVIVOR'),
       ('${LOSER}', 'probe_loser', 'probe_loser', 'Probe loser', 'UC_PROBE_LOSER');

insert into public.memberships (id, channel_id, community_channel_id, lifetime_xp)
values ('${M_SURVIVOR}', '${SURVIVOR}', '${COMMUNITY}', 1000),
       ('${M_LOSER}', '${LOSER}', '${COMMUNITY}', 500);
`;

type Case = { name: string; steps: string; check: string; expect: Record<string, unknown> };

const CASES: Case[] = [
  {
    name: "the earning line is written from XP when a membership appears",
    steps: "",
    check: `select amount, kind from public.credit_entries where membership_id = '${M_SURVIVOR}'`,
    expect: { amount: 100, kind: "earned" },
  },
  {
    name: "changing XP rewrites the earning line and the cached balance",
    steps: `update public.memberships set lifetime_xp = 2500 where id = '${M_SURVIVOR}';`,
    check: `select (select amount from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'earned') as amount,
                   (select credits from public.memberships where id = '${M_SURVIVOR}') as cached`,
    expect: { amount: 250, cached: 250 },
  },
  {
    name: "a spend beyond the balance is refused and writes nothing",
    steps: `select public.spend_credits('${M_SURVIVOR}', 500, 'tts', null);`,
    check: `select (select count(*)::int from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind <> 'earned') as spend_lines,
                   (select credits from public.memberships where id = '${M_SURVIVOR}') as cached`,
    expect: { spend_lines: 0, cached: 100 },
  },
  {
    name: "a spend within the balance is written and the cache follows",
    steps: `select public.spend_credits('${M_SURVIVOR}', 25, 'tts', 'probe');`,
    check: `select (select credits from public.memberships where id = '${M_SURVIVOR}') as cached,
                   (select amount from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'tts') as spent`,
    expect: { cached: 75, spent: -25 },
  },
  {
    name: "a re-score rewrites earnings and never touches the spend",
    steps: `select public.spend_credits('${M_SURVIVOR}', 25, 'tts', 'probe');
            update public.memberships set lifetime_xp = 300 where id = '${M_SURVIVOR}';`,
    check: `select (select amount from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'earned') as earned,
                   (select amount from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'tts') as spent,
                   (select credits from public.memberships where id = '${M_SURVIVOR}') as cached`,
    expect: { earned: 30, spent: -25, cached: 5 },
  },
  {
    name: "an earning line is rewritten, never duplicated",
    steps: `select public.write_earned_credits('${M_SURVIVOR}', 1000);
            select public.write_earned_credits('${M_SURVIVOR}', 2000);`,
    check: `select count(*)::int as earned_lines, max(amount) as amount from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'earned'`,
    expect: { earned_lines: 1, amount: 200 },
  },
  {
    name: "an earning kind cannot be spent through the spend path",
    steps: `select public.spend_credits('${M_SURVIVOR}', 10, 'earned', null);`,
    check: `select count(*)::int as earned_lines from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'earned'`,
    expect: { earned_lines: 1 },
  },
  {
    name: "deleting a membership takes its ledger lines with it",
    steps: `select public.spend_credits('${M_LOSER}', 10, 'tts', 'probe');
            delete from public.memberships where id = '${M_LOSER}';`,
    check: `select count(*)::int as n from public.credit_entries where membership_id = '${M_LOSER}'`,
    expect: { n: 0 },
  },
  {
    name: "a merge carries spends to the survivor and re-derives earnings from pooled XP",
    steps: `select public.spend_credits('${M_LOSER}', 20, 'tts', 'probe');
            update public.credit_entries set membership_id = '${M_SURVIVOR}'
             where membership_id = '${M_LOSER}' and kind <> 'earned';
            delete from public.memberships where id = '${M_LOSER}';
            update public.memberships set lifetime_xp = 1500 where id = '${M_SURVIVOR}';`,
    check: `select (select count(*)::int from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'earned') as earned_lines,
                   (select amount from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'earned') as earned,
                   (select amount from public.credit_entries where membership_id = '${M_SURVIVOR}' and kind = 'tts') as carried_spend,
                   (select credits from public.memberships where id = '${M_SURVIVOR}') as cached`,
    expect: { earned_lines: 1, earned: 150, carried_spend: -20, cached: 130 },
  },
];

async function runCase(c: Case): Promise<boolean> {
  const sql = `begin;\n${SEED}\n${c.steps}\n${c.check};\nrollback;`;
  const rows = await query(sql);
  const row = rows[rows.length - 1] ?? {};
  let pass = true;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(c.expect)) {
    const actual = row[k];
    const same = String(actual) === String(v);
    if (!same) pass = false;
    parts.push(`${k}=${actual}${same ? "" : ` (expected ${v})`}`);
  }
  console.log(`${pass ? "OK  " : "FAIL"} ${c.name}\n       ${parts.join(", ")}`);
  return pass;
}

async function main() {
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required — run with: doppler run -c dev_personal -- npm run verify:credit-merge"
    );
  }
  let failures = 0;
  for (const c of CASES) {
    const passed = await runCase(c).catch((e) => {
      console.error(`FAIL ${c.name}\n       ${(e as Error).message}`);
      return false;
    });
    if (!passed) failures += 1;
  }
  console.log(`\n${CASES.length - failures}/${CASES.length} cases passed`);
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
