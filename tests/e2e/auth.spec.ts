import { test, expect } from "@playwright/test";

test("signup shows the verification-pending state", async ({ page }) => {
  const email = `e2e_${Date.now()}@test.local`;

  await page.goto("/signup");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Password123!");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/verify$/);
  await expect(
    page.getByRole("heading", { name: "Check your email" })
  ).toBeVisible();
});

test("seeded owner can log in and log out", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "owner@vids.tube");
  await page.fill('input[name="password"]', "Password123!");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});
