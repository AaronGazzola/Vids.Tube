import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerSlug: string;
let ownerId: string;
let memberHandle: string;
let memberName: string;
let memberCount: number;

test.beforeAll(async () => {
  const { data: owner, error } = await admin
    .from("channels")
    .select("id, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !owner) throw error ?? new Error("owner channel missing");
  ownerSlug = owner.slug;
  ownerId = owner.id;

  const { data: count } = await admin.rpc("community_member_count", {
    p_community: owner.id,
  });
  memberCount = count ?? 0;

  // The busiest unclaimed member: the case a greeted chatter actually lands on.
  const { data: memberships } = await admin
    .from("memberships")
    .select("channel_id, message_count")
    .eq("community_channel_id", owner.id)
    .order("message_count", { ascending: false })
    .limit(20);
  const ids = (memberships ?? []).map((m) => m.channel_id);
  const { data: channels } = await admin
    .from("channels")
    .select("handle, name, owner_user_id, youtube_channel_id, is_software")
    .in("id", ids);
  const unclaimed = (channels ?? []).find(
    (c) => !c.owner_user_id && c.youtube_channel_id && !c.is_software
  );
  if (!unclaimed) throw new Error("no unclaimed member channel to test against");
  memberHandle = unclaimed.handle;
  memberName = unclaimed.name;
});

test("an unclaimed member's page shows their memberships, not a stats stub", async ({
  page,
}) => {
  await page.goto(`/${memberHandle}`);

  await expect(page.getByRole("heading", { name: memberName })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Memberships" })
  ).toBeVisible();

  const card = page.locator(`#community-${ownerSlug}`);
  await expect(card).toBeVisible();
  await expect(card.getByText("level", { exact: true })).toBeVisible();
  await expect(card.getByText("XP", { exact: true })).toBeVisible();
  await expect(card.getByText("credits", { exact: true })).toBeVisible();
  await expect(card.getByText("messages", { exact: true })).toBeVisible();
  // Broadcasts the member turned up to, not ones they ran.
  await expect(card.getByText("attended", { exact: true })).toBeVisible();
  await expect(card.getByText("streak", { exact: true })).toBeVisible();
  await expect(card.getByText("best streak", { exact: true })).toBeVisible();
});

test("the community parameter highlights the matching membership", async ({
  page,
}) => {
  await page.goto(`/${memberHandle}?c=${ownerSlug}`);

  const card = page.locator(`#community-${ownerSlug}`);
  await expect(card).toBeVisible();
  // The highlight is what a chatter arriving from their greeting sees; with one
  // community there is nothing to scroll past, so the ring is the whole signal.
  await expect(card).toHaveClass(/ring-2/);
});

test("an unknown community parameter is harmless", async ({ page }) => {
  await page.goto(`/${memberHandle}?c=not-a-real-community`);

  await expect(
    page.getByRole("heading", { name: "Memberships" })
  ).toBeVisible();
  await expect(page.locator(`#community-${ownerSlug}`)).not.toHaveClass(
    /ring-2/
  );
});

test("an anonymous visitor is asked whether the profile is theirs", async ({
  page,
}) => {
  await page.goto(`/${memberHandle}`);

  await expect(page.getByText("Is this you?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Claim" })).toBeVisible();
  // Anyone can open this page from a link in chat, so it must not tell the
  // reader the page belongs to them.
  await expect(page.getByText("This page is already here")).toHaveCount(0);
});

test("a claimed channel never offers the claim", async ({ page }) => {
  await page.goto(`/${ownerSlug}`);

  await expect(page.getByText("Is this you?")).toHaveCount(0);
});

test("the host channel shows its community with the member total", async ({
  page,
}) => {
  await page.goto(`/${ownerSlug}`);

  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
  await expect(
    page.getByText(memberCount.toLocaleString("en-US"), { exact: true })
  ).toBeVisible();
});

test("the leaderboard expands in place rather than navigating away", async ({
  page,
}) => {
  await page.goto(`/${ownerSlug}`);

  const community = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Community" }) });
  const rows = community.locator("ul > li");
  await expect(rows).toHaveCount(5);

  const more = page.getByRole("button", { name: /Show more/ });
  await expect(more).toBeVisible();
  await more.click();

  await expect(rows).toHaveCount(10);
  await expect(page).toHaveURL(new RegExp(`/${ownerSlug}$`));
});

test("a leaderboard entry links to that member's membership", async ({
  page,
}) => {
  await page.goto(`/${ownerSlug}`);

  const community = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Community" }) });
  const first = community.locator("ul > li a").first();
  await expect(first).toHaveAttribute("href", new RegExp(`\\?c=${ownerSlug}$`));

  await first.click();
  await expect(page.locator(`#community-${ownerSlug}`)).toHaveClass(/ring-2/);
});

test("the community section offers all-time and latest-stream, and no live tab when off air", async ({
  page,
}) => {
  await page.goto(`/${ownerSlug}`);

  const community = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Community" }) });

  const allTime = community.getByRole("tab", { name: "All time" });
  await expect(allTime).toHaveAttribute("aria-selected", "true");
  await expect(community.getByRole("tab", { name: "Latest stream" })).toBeVisible();
  await expect(community.getByRole("tab", { name: "Now live" })).toHaveCount(0);
});

test("the latest-stream tab shows that broadcast's standing", async ({ page }) => {
  await page.goto(`/${ownerSlug}`);

  const community = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Community" }) });

  await community.getByRole("tab", { name: "Latest stream" }).click();
  await expect(
    community.getByRole("tab", { name: "Latest stream" })
  ).toHaveAttribute("aria-selected", "true");

  // A per-broadcast board reports what was earned in it, not a lifetime level.
  await expect(community.getByText(/\d+ XP · \d+ msg/).first()).toBeVisible();
  await expect(community.getByText(/took part/)).toBeVisible();
});

test("going live opens on a distinguished live tab, and ending restores all-time", async ({
  page,
}) => {
  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .eq("slug", ownerSlug)
    .maybeSingle();
  const { data: target } = await admin
    .from("streams")
    .select("id, status")
    .eq("channel_id", owner!.id)
    .eq("status", "ended")
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  test.skip(!target, "no finished broadcast to borrow");

  try {
    await admin.from("streams").update({ status: "live" }).eq("id", target!.id);

    await page.goto(`/${ownerSlug}`);
    const community = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Community" }) });

    const liveTab = community.getByRole("tab", { name: "Now live" });
    await expect(liveTab).toBeVisible({ timeout: 25_000 });
    await expect(liveTab).toHaveAttribute("aria-selected", "true");
    // Marked as live: a red outline and a red dot, not just another tab.
    await expect(liveTab).toHaveClass(/destructive/);
    await expect(liveTab.locator("span").first()).toHaveClass(/rounded-full/);

    // Choosing another tab must stick.
    await community.getByRole("tab", { name: "All time" }).click();
    await expect(
      community.getByRole("tab", { name: "All time" })
    ).toHaveAttribute("aria-selected", "true");
  } finally {
    await admin
      .from("streams")
      .update({ status: target!.status })
      .eq("id", target!.id);
  }

  await page.goto(`/${ownerSlug}`);
  const after = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Community" }) });
  await expect(after.getByRole("tab", { name: "Now live" })).toHaveCount(0);
  await expect(after.getByRole("tab", { name: "All time" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("the opacity control dims the overlay backing and leaves the text alone", async ({
  page,
}) => {
  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .eq("slug", ownerSlug)
    .maybeSingle();
  const { data: layout } = await admin
    .from("overlay_layouts")
    .select("token")
    .eq("channel_id", owner!.id)
    .maybeSingle();
  test.skip(!layout?.token, "no overlay layout to read");

  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`/overlay/${ownerSlug}?token=${layout!.token}`);
  await page.waitForSelector("text=Chat to become a Vids.Tube member", {
    timeout: 25_000,
  });

  // The variable is written by the positioner and read by the surface, so the
  // check drives it directly rather than editing the owner's saved layout.
  const result = await page.evaluate(() => {
    const surface = document.querySelector(
      "div.overlay-surface"
    ) as HTMLElement;
    const holder = surface.closest("[style*='--overlay-bg-opacity']") as HTMLElement;
    const read = () => {
      const cs = getComputedStyle(surface);
      return { bg: cs.backgroundColor, opacity: cs.opacity, color: cs.color };
    };
    holder.style.setProperty("--overlay-bg-opacity", "1");
    const full = read();
    holder.style.setProperty("--overlay-bg-opacity", "0.2");
    const dim = read();
    return { full, dim };
  });

  const alphaOf = (rgba: string) => {
    const m = rgba.match(/rgba?\(([^)]+)\)/);
    const parts = m![1].split(",").map((p) => parseFloat(p));
    return parts.length > 3 ? parts[3] : 1;
  };

  // The backing fades in proportion.
  expect(alphaOf(result.full.bg)).toBeCloseTo(0.7, 2);
  expect(alphaOf(result.dim.bg)).toBeCloseTo(0.14, 2);

  // The box itself is never faded, so the text stays fully legible at any
  // setting — dimming the element used to take the words with it.
  expect(result.full.opacity).toBe("1");
  expect(result.dim.opacity).toBe("1");
  expect(result.dim.color).toBe("rgb(255, 255, 255)");
});

test("the members strip reads as one phrase down its right-hand side", async ({
  page,
}) => {
  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .eq("slug", ownerSlug)
    .maybeSingle();
  const { data: layout } = await admin
    .from("overlay_layouts")
    .select("token")
    .eq("channel_id", owner!.id)
    .maybeSingle();
  test.skip(!layout?.token, "no overlay layout to read");

  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`/overlay/${ownerSlug}?token=${layout!.token}`);

  await expect(
    page.getByText("Chat to become a Vids.Tube member")
  ).toBeVisible({ timeout: 25_000 });
  await expect(
    page.getByText("Chat to become a Vids.Tube member", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Members", { exact: true })).toBeVisible();
  await expect(page.getByText(/See your stats/)).toHaveCount(0);

  const surface = page.locator("div.overlay-surface").filter({
    has: page.getByText("Chat to become a Vids.Tube member"),
  });
  const style = await surface.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      color: cs.borderTopColor,
      width: cs.borderTopWidth,
      radius: cs.borderTopLeftRadius,
      backdrop: cs.backdropFilter,
    };
  });
  // A hairline white border with rounded corners, so the strip holds its edge
  // against any picture behind it.
  expect(style.color).toBe("rgb(255, 255, 255)");
  expect(parseFloat(style.width)).toBeCloseTo(1, 1);
  expect(parseFloat(style.radius)).toBeGreaterThan(0);
  // No blur: frosting what is behind reads as a solid panel however far the
  // opacity control is wound down, which defeats the control.
  expect(style.backdrop).toBe("none");
});

test("a channel that has published nothing renders no videos section", async ({
  page,
}) => {
  await page.goto(`/${memberHandle}`);

  await expect(
    page.getByRole("heading", { name: "Memberships" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Videos" })).toHaveCount(0);
  await expect(page.getByText("No videos yet.")).toHaveCount(0);
});

test("a channel that has published keeps its videos section", async ({
  page,
}) => {
  await page.goto(`/${ownerSlug}`);

  await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();
});

test("a channel with no memberships renders no memberships section", async ({
  page,
}) => {
  // The owner hosts a community and joins none, so their own memberships
  // section must be absent rather than empty.
  const { data: rows } = await admin
    .from("memberships")
    .select("id")
    .eq("channel_id", ownerId);
  test.skip((rows ?? []).length > 0, "the owner now holds a membership");

  await page.goto(`/${ownerSlug}`);
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Memberships" })
  ).toHaveCount(0);
});
