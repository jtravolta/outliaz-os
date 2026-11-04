import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox").fill("sam@acmestudio.co");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/dashboard");
}

test.beforeEach(async ({ page }) => signIn(page));

test("inbox list opens a real reply detail", async ({ page }) => {
  await page.goto("/inbox");
  await expect(
    page.getByRole("heading", { level: 1, name: "Inbox" }),
  ).toBeVisible();
  const firstReply = page
    .locator(".inbox-table")
    .getByRole("link", { name: /^Open reply from / })
    .first();
  await expect(firstReply).toHaveAttribute("href", /\/inbox\/[\w-]+/);
  await firstReply.click();
  await expect(page).toHaveURL(/\/inbox\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Received", { exact: true })).toBeVisible();
});

test("inbox and dashboard fit a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/inbox", "/dashboard"]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${route} should not overflow horizontally`,
    ).toBe(true);
  }
});

test("prospect names do not navigate to missing detail routes", async ({
  page,
}) => {
  await page.goto("/prospects");
  const business = page.locator("[data-prospect-name]:visible").first();
  await expect(business).toHaveAttribute(
    "href",
    /\/prospects\?prospect=[\w-]+/,
  );
  const href = await business.getAttribute("href");
  await page.goto(href!);
  await expect(
    page.getByRole("heading", { level: 1, name: "Prospects" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);
});

test("outreach is a draft-only editor", async ({ page }) => {
  let saved = false;
  await page.route("**/api/prospects/*/draft", async (route) => {
    if (route.request().method() === "PUT") {
      saved = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ draft: route.request().postDataJSON() }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/outreach");
  await expect(
    page.getByRole("heading", { level: 1, name: "Outreach" }),
  ).toBeVisible();
  await expect(
    page.getByText("Draft · not sent", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Prospect", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: /send/i })).toHaveCount(0);
  await page.getByLabel("Subject").fill("A useful first draft");
  await page
    .getByLabel("Message")
    .fill("This is saved for later and must not be sent.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByText("Saved · not sent", { exact: true }),
  ).toBeVisible();
  expect(saved).toBe(true);
});

test("settings controls have accessible labels", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  for (const name of [
    "Workspace name",
    "Timezone",
    "Send window start",
    "Send window end",
    "Daily send cap",
    "Hourly send cap",
    "Footer text",
  ]) {
    await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  }
});

test("offers uses consistent naming and clean summaries", async ({ page }) => {
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { level: 1, name: "Offers" }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("**");
});
