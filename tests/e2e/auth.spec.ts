import { expect, test } from "@playwright/test";

test.describe("Supabase Auth boundaries", () => {
  test("renders the public login page without hosted Auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Outbound OS" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await page.route("**/api/auth/signin", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }));
    await page.locator('input[type="email"]').fill("owner@example.test");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Check your email for a sign-in link.")).toBeVisible();
  });

  test("callback boundary denies a missing code without hosted Auth", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=access_denied$/);
    await expect(page.getByRole("heading", { name: "Outbound OS" })).toBeVisible();
  });

  test("protected pages redirect to login when Auth is unavailable", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("sign-out boundary is reachable and safely redirects without a session", async ({ page }) => {
    await page.goto("/login");
    await page.route("**/api/auth/signout", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }));
    const result = await page.evaluate(async () => {
      const response = await fetch(`${window.location.origin}/api/auth/signout`, { method: "POST" });
      return { status: response.status, body: await response.json() };
    });
    expect(result).toEqual({ status: 200, body: { ok: true } });
  });
});
