import { expect, test } from "@playwright/test";

test("home renders the owner channel experience", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "vids.tube" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Owner Channel" })
  ).toBeVisible();
});

test("live path redirects to the owner channel page", async ({ page }) => {
  await page.goto("/live");
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByText("Live chat")).toHaveCount(0);
});

test("account redirects anonymous users to login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("studio redirects non-owners to home", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL("/");
});
