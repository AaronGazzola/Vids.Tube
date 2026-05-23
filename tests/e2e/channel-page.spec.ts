import { test, expect } from "@playwright/test";

test("seeded owner channel renders name and description", async ({ page }) => {
  await page.goto("/owner");

  await expect(
    page.getByRole("heading", { name: "Owner Channel" })
  ).toBeVisible();
  await expect(page.getByText("No videos yet.")).toBeVisible();
});

test("unknown channel shows the not-found state", async ({ page }) => {
  await page.goto("/this-channel-does-not-exist");

  await expect(
    page.getByRole("heading", { name: "Channel not found" })
  ).toBeVisible();
});
