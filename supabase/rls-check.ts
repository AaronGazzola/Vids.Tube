import type { Database } from "@/supabase/types";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  }
}

async function run() {
  const stamp = Date.now();
  const emailA = `rls_a_${stamp}@test.local`;
  const emailB = `rls_b_${stamp}@test.local`;
  const password = "Password123!";

  const { data: a, error: aErr } = await admin.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (aErr || !a.user) throw aErr ?? new Error("failed to create user A");

  const { data: b, error: bErr } = await admin.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (bErr || !b.user) throw bErr ?? new Error("failed to create user B");

  const anon = createClient<Database>(url, publishableKey);
  const { error: anonReadErr } = await anon.from("channels").select("*");
  assert("anonymous can read channels", anonReadErr === null);

  const clientA = createClient<Database>(url, publishableKey);
  const { error: signInErr } = await clientA.auth.signInWithPassword({
    email: emailA,
    password,
  });
  if (signInErr) throw signInErr;

  const { error: ownInsertErr } = await clientA.from("channels").insert({
    owner_user_id: a.user.id,
    slug: `rls_own_${stamp}`,
    name: "User A channel",
  });
  assert("owner can insert their own channel", ownInsertErr === null);

  const { error: crossInsertErr } = await clientA.from("channels").insert({
    owner_user_id: b.user.id,
    slug: `rls_cross_${stamp}`,
    name: "Should fail",
  });
  assert("cross-user insert is rejected", crossInsertErr !== null);

  await admin.from("channels").delete().eq("owner_user_id", a.user.id);
  await admin.auth.admin.deleteUser(a.user.id);
  await admin.auth.admin.deleteUser(b.user.id);
}

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error("RLS check failed:", error);
    process.exit(1);
  });
