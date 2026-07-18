import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerChannelId: string;
let ownerSlug: string;
const stamp = Date.now();

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
  ownerSlug = owner!.slug;
});

async function ownerIsLive(): Promise<boolean> {
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  return (count ?? 0) > 0;
}

async function seedLive(title: string) {
  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/live/index.m3u8",
      title,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();
  return live!.id;
}

test("the owner approves a suggested ask with the include-answer checkbox", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  const streamId = await seedLive(`E2E ask panel ${stamp}`);
  const { data: request } = await admin
    .from("ask_requests")
    .insert({
      channel_id: ownerChannelId,
      stream_id: streamId,
      participant_key: "youtube:UC_ASK_E2E",
      origin: "youtube",
      author_name: "AskFan",
      question: `E2E what rig ${stamp}`,
      answer: `E2E a mighty rig ${stamp}`,
      reason: "Grounded in the FAQ",
      status: "suggested",
    })
    .select("id")
    .single();

  try {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    await page.goto("/live");
    await page.getByRole("tab", { name: "Activity" }).click();
    await page.getByRole("button", { name: /Ask requests/ }).click();
    await expect(page.getByText(`E2E what rig ${stamp}`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(`E2E a mighty rig ${stamp}`)).toBeVisible();
    await expect(page.getByText("Include AI response")).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("ask_requests")
            .select("status, include_answer")
            .eq("id", request!.id)
            .single();
          return `${data?.status}:${data?.include_answer}`;
        },
        { timeout: 15_000 }
      )
      .toBe("approved:true");
  } finally {
    await admin.from("ask_requests").delete().eq("stream_id", streamId);
    await admin.from("streams").delete().eq("id", streamId);
  }
});

test("the overlay shows the mirrored Q&A exchange and marks it shown", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  const streamId = await seedLive(`E2E ask overlay ${stamp}`);
  const { data: request } = await admin
    .from("ask_requests")
    .insert({
      channel_id: ownerChannelId,
      stream_id: streamId,
      participant_key: "youtube:UC_ASK_E2E",
      origin: "youtube",
      author_name: "AskFan",
      question: `E2E overlay question ${stamp}`,
      answer: `E2E overlay answer ${stamp}`,
      reason: "Grounded",
      status: "approved",
      include_answer: true,
      approved_at: new Date().toISOString(),
      answer_delivered_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  try {
    await page.goto(`/overlay/${ownerSlug}`);
    await expect(page.getByText(`E2E overlay question ${stamp}`)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(`E2E overlay answer ${stamp}`)).toBeVisible();
    await expect(page.getByText("VidsBot", { exact: true })).toBeVisible();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("ask_requests")
            .select("status")
            .eq("id", request!.id)
            .single();
          return data?.status;
        },
        { message: "exchange flips to shown after the hold", timeout: 30_000 }
      )
      .toBe("shown");
    await expect(
      page.getByText(`E2E overlay question ${stamp}`)
    ).toHaveCount(0, { timeout: 15_000 });
  } finally {
    await admin.from("ask_requests").delete().eq("stream_id", streamId);
    await admin.from("streams").delete().eq("id", streamId);
  }
});
