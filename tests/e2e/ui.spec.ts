import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

test("homepage navigation, preview disclosure and FAQ", async ({ page, isMobile }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One Beat.Every Device.");
  await expect(
    page.getByText("Room sessions are ready. Music playback is coming soon."),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: !isMobile,
    caret: "initial",
  });
  if (isMobile) {
    const toggle = page.getByRole("button", { name: /^(Open|Close) navigation$/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Features" })
      .click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeHidden();
  } else {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Features" })
      .click();
  }
  await expect(page).toHaveURL(/#features$/);
  await page.getByText("Can I start listening now?", { exact: true }).click();
  await expect(page.getByText("Not yet. You can create rooms", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Create a room", exact: true }).first().click();
  await expect(page).toHaveURL(/\/create$/);
  expect(errors).toEqual([]);
});

test("core pages have no detected WCAG A/AA accessibility violations", async ({ page }) => {
  for (const path of ["/", "/create", "/join"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("nextjs-portal")
      .analyze();
    expect(results.violations, `${path} accessibility`).toEqual([]);
  }
});

test("create form validates accessibly and creates a real room", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") mutations.push(request.url());
  });
  await page.goto("/create");
  const input = page.getByLabel("Display name", { exact: false });
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a display name between 2 and 32 characters.")).toBeVisible();
  await input.fill("  রোশনি  ");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/room\/[A-Z2-9]{12}$/);
  await expect(page.getByRole("status", { name: "Connection status" })).toHaveText("Connected");
  await expect(page.getByRole("heading", { name: "Welcome, রোশনি" })).toBeVisible();
  expect(mutations.some((url) => url.endsWith("/api/v1/rooms"))).toBe(true);
});

test("join form validates format and reports unavailable rooms", async ({ page }, testInfo) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") mutations.push(request.url());
  });
  await page.goto("/join");
  await page.screenshot({
    path: testInfo.outputPath("join.png"),
    fullPage: true,
    caret: "initial",
  });
  const code = page.getByLabel("Room ID", { exact: false });
  await page.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(code).toBeFocused();
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await code.fill("abcd-efgh-jk23");
  await page.getByLabel("Display name", { exact: false }).fill("Alex");
  await page.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(code).toHaveValue("ABCDEFGHJK23");
  await expect(page.getByRole("status")).toContainText("unavailable or has expired");
  await code.fill("OOOO-1111-0000");
  await expect(page.getByRole("status")).toBeEmpty();
  await page.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(code).toHaveAttribute("aria-invalid", "true");
  expect(mutations.filter((url) => url.endsWith("/join"))).toHaveLength(1);
});

test("routes fit narrow screens and support keyboard and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of ["/", "/create", "/join"]) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({
      width: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
    expect(dimensions.scrollBehavior).toBe("auto");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  }
  await page.goto("/missing-page");
  await expect(page.getByRole("heading", { name: "This page isn't playing." })).toBeVisible();
  await page.getByRole("link", { name: "Back to AllPlay", exact: true }).click();
  await expect(page).toHaveURL("/");
});
