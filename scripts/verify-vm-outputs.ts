// Confirms every finalized recording still sitting on the streaming machine is
// present in R2 before any of them is deleted. Local disk is a staging area;
// R2 is the store. Nothing is removed by this script — it only reports.
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET_VOD!;

async function head(key: string): Promise<number | null> {
  try {
    const res = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return res.ContentLength ?? 0;
  } catch {
    return null;
  }
}

async function main() {
  const listing = process.argv.slice(2);
  if (!listing.length) {
    throw new Error(
      "pass the local paths to check, e.g. --- /var/lib/vids-tube/out/owner/1785078234.mp4 ..."
    );
  }

  let present = 0;
  let missing = 0;
  let bytes = 0;
  for (const path of listing) {
    const m = /\/out\/([^/]+)\/(\d+)\.mp4$/.exec(path);
    if (!m) {
      console.log(`SKIP     ${path} (not a finalized recording path)`);
      continue;
    }
    const [, slug, ts] = m;
    const key = `vod/${slug}/${ts}.mp4`;
    const size = await head(key);
    if (size === null) {
      console.log(`MISSING  ${key}`);
      missing += 1;
      continue;
    }
    present += 1;
    bytes += size;
    console.log(`present  ${key}  ${(size / 1048576).toFixed(0)} MB`);
  }

  console.log(`\nin R2: ${present}, missing: ${missing}, ${(bytes / 1073741824).toFixed(1)} GB verified`);
  if (missing) {
    console.error("\nsome recordings are not in R2 — do not delete the local copies");
    process.exit(1);
  }
  console.log("every local recording is in R2; the local copies are safe to remove");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
