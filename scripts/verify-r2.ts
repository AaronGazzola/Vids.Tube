import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID!;
const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const bucket = process.env.R2_BUCKET_VOD!;
const baseUrl = process.env.NEXT_PUBLIC_VOD_BASE_URL!;

const key = "_verify-r2.txt";
const body = "verify-r2-ok";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
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
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    })
  );
  console.log(`PASS: PUT ${bucket}/${key}`);

  const res = await fetch(`${baseUrl}/${key}`, {
    headers: { Origin: "https://vids.tube" },
  });
  assert("GET via NEXT_PUBLIC_VOD_BASE_URL returns 200", res.status === 200);

  const text = await res.text();
  assert("body matches", text === body);

  assert(
    "CORS allows https://vids.tube",
    res.headers.get("access-control-allow-origin") === "https://vids.tube"
  );

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`PASS: DELETE ${bucket}/${key}`);
}

run()
  .then(() => {
    if (process.exitCode === 1) {
      console.error("verify-r2 failed");
      process.exit(1);
    }
    console.log("verify-r2 complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("verify-r2 error:", error);
    process.exit(1);
  });
