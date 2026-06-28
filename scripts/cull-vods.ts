import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const DELETE_IDS = [
  "c2f40fae-cf17-49a9-8c12-22fbd5cfa961",
  "c386cdc0-2665-481a-b9bb-261660ea5a30",
  "dc94b08f-8bdc-4b97-b047-d070e678fddb",
  "b88d18e6-8bad-48ad-b5a7-81513186acba",
  "140b2c06-6add-46f6-9cc8-f83358ce0a01",
  "8ca25a04-3130-4dd2-a689-6fa0e5742448",
  "585af792-f1af-4d5b-a90f-452429e6437f",
  "0a6f5580-9377-498a-868b-622526645968",
];

const KEEP_IDS = [
  "729ad7d0-62a5-4729-a4f0-d74e6fc0d717",
  "278bbe9b-6e8f-44e4-9828-2fa8fc9aefa3",
  "403ada2e-e454-44e1-9c89-c1d473165882",
  "1dcb35b7-d224-4d31-9de0-f9441f3932e7",
];

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
);

const bucket = process.env.R2_BUCKET_VOD!;
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function r2Delete(key: string) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`  r2 deleted ${key}`);
  } catch (e) {
    console.error(`  r2 delete failed ${key}:`, (e as Error).message);
  }
}

async function main() {
  const { data: rows } = await admin
    .from("videos")
    .select("id, title, status, mp4_path, thumbnail_path, duration_s")
    .in("id", DELETE_IDS);

  if (!rows?.length) {
    console.log("Nothing to delete (already culled?).");
    return;
  }

  if (rows.some((r) => KEEP_IDS.includes(r.id))) {
    console.error("ABORT: a keep-id appeared in the delete set.");
    process.exit(1);
  }

  console.log(`Deleting ${rows.length} videos:\n`);
  for (const v of rows) {
    console.log(`- ${v.status} ${v.duration_s ?? "—"}s  ${(v.title ?? "").slice(0, 40)}  (${v.id})`);
    if (v.mp4_path) await r2Delete(v.mp4_path);
    if (v.thumbnail_path) await r2Delete(v.thumbnail_path);
  }

  const { error } = await admin.from("videos").delete().in("id", DELETE_IDS);
  if (error) {
    console.error("DB delete failed:", error.message);
    process.exit(1);
  }

  const { count } = await admin
    .from("videos")
    .select("id", { count: "exact", head: true });
  console.log(`\nDone. ${rows.length} videos removed. ${count} videos remain.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
