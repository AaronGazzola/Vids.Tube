import { expect, test } from "@playwright/test";

test("home renders the live area and nav", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "vids.tube" })).toBeVisible();
  await expect(page.getByText("No live stream right now")).toBeVisible();
});

test("live page shows the offline state and chat panel", async ({ page }) => {
  await page.goto("/live");
  await expect(page.getByText("No live stream right now")).toBeVisible();
  await expect(page.getByText("Live chat")).toBeVisible();
});

test("account redirects anonymous users to login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("studio redirects non-owners to home", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL("/");
});
