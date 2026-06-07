import { test, expect } from "@playwright/test";

test("signup shows the verification-pending state", async ({ page }) => {
  const email = `e2e_${Date.now()}@test.local`;

  await page.goto("/signup");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Password123!");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/verify$/);
  await expect(
    page.getByText("Check your email", { exact: true })
  ).toBeVisible();
});

test("seeded owner can log in and log out", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});
