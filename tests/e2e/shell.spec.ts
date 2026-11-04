import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  // This shell fixture has no database/auth imports. Block accidental API writes.
  await page.route("**/api/**", async (route) => {
    if (!["GET", "HEAD"].includes(route.request().method())) {
      throw new Error("Shell review must not mutate application data");
    }
    await route.continue();
  });
  await page.goto("/ui-review");
});

test("shows named destinations, real hrefs and one app frame", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(
    nav.getByRole("link", { name: "Today", exact: true }),
  ).toHaveAttribute("href", "/dashboard");
  await expect(
    nav.getByRole("link", { name: "Prospects", exact: true }),
  ).toHaveAttribute("href", "/prospects");
  await expect(
    nav.getByRole("link", { name: "Sources", exact: true }),
  ).toHaveAttribute("href", "/sources");
  await expect(
    nav.getByRole("link", { name: "Outreach", exact: true }),
  ).toHaveAttribute("href", "/outreach");
  await expect(
    nav.getByRole("link", { name: "Inbox", exact: true }),
  ).toHaveAttribute("href", "/inbox");
  await expect(
    nav.getByRole("link", { name: "Offers", exact: true }),
  ).toHaveAttribute("href", "/library");
  await expect(
    nav.getByRole("link", { name: "Reports", exact: true }),
  ).toHaveAttribute("href", "/reports");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("UI preview", { exact: true })).toBeVisible();
});

test("remembers collapse, preserves names and exposes focus tooltip", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toHaveAttribute("aria-expanded", "false");
  const offers = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Offers", exact: true });
  await offers.focus();
  await expect(page.getByRole("tooltip")).toHaveText("Offers");
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(
    page.getByRole("button", { name: "Collapse sidebar" }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("starts dark, toggles to light and remembers the choice", async ({
  page,
}) => {
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(17, 17, 15)",
  );
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to dark theme" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(244, 241, 234)",
  );
});

test("works when browser preference storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.reload();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(
    page.getByRole("button", { name: "Switch to dark theme" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
});

test("mobile More is labelled, keyboard accessible and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).not.toBeVisible();
  const bottom = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(bottom.getByRole("link")).toHaveCount(3);
  const more = bottom.getByRole("button", { name: "More" });
  await more.click();
  const dialog = page.getByRole("dialog", { name: "Workspace" });
  await expect(dialog).toBeVisible();
  for (const name of [
    "Sources",
    "Outreach",
    "Offers",
    "Reports",
    "Settings",
    "Runs",
    "Sequences",
  ]) {
    await expect(dialog.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(more).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("loads the actual font, provides skip navigation and accessible shell", async ({
  page,
}) => {
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toHaveAttribute("href", "#main-content");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (font) =>
          font.family.includes("IBM Plex Sans") && font.status === "loaded",
      ),
    ),
  ).toBe(true);
  const dark = await new AxeBuilder({ page }).analyze();
  expect(dark.violations).toEqual([]);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  const light = await new AxeBuilder({ page }).analyze();
  expect(light.violations).toEqual([]);
});

test("keeps sidebar settings reachable on short desktops", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const settings = page
    .getByRole("complementary", { name: "Workspace sidebar" })
    .getByRole("link", { name: "Settings", exact: true });
  await settings.scrollIntoViewIfNeeded();
  await expect(settings).toBeInViewport();
});

test("mobile command launcher does not cover the More touch target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-command-launcher]")).not.toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "More" })
    .click();
  await expect(page.getByRole("dialog", { name: "Workspace" })).toBeVisible();
});
