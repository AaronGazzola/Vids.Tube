import { test, expect } from "@playwright/test";

test("home renders the channel and video grid", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "vids.tube" })).toBeVisible();
});

test("credits page renders packages and history", async ({ page }) => {
  await page.goto("/credits");
  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Buy credits" })
  ).toBeVisible();
});

test("live page shows the sign-in wall for anonymous viewers", async ({
  page,
}) => {
  await page.goto("/live");
  await expect(
    page.getByRole("heading", { name: "Sign in to keep watching" })
  ).toBeVisible();
});

test("watch page renders a player placeholder", async ({ page }) => {
  await page.goto("/watch/sample");
  await expect(page.getByText("Player coming soon")).toBeVisible();
  await expect(page.getByText("Comments coming soon")).toBeVisible();
});

test("account redirects anonymous users to login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("studio redirects non-owners to home", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL("/");
});
