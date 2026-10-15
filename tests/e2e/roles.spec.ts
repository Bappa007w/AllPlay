import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

test("Host manages Officers and removes a participant with live role updates", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext();
  const guest = await context.newPage();
  try {
    await page.goto("/create");
    await page.getByLabel("Display name", { exact: false }).fill("Role Host");
    await page.getByRole("button", { name: "Create room", exact: true }).click();
    await expect(page.getByRole("status", { name: "Connection status" })).toHaveText("Connected");
    await guest.goto(page.url());
    await guest.getByLabel("Display name", { exact: false }).fill("Officer Guest");
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(guest.getByRole("status", { name: "Connection status" })).toHaveText("Connected");
    await expect(page.getByRole("heading", { name: "Participants (2/20)" })).toBeVisible();
    await page.getByRole("button", { name: "Promote Officer Guest", exact: true }).click();
    await expect(guest.getByRole("status", { name: "Officer count" })).toHaveText("Officers: 1/3");
    await expect(guest.getByText("Your role:")).toHaveText("Your role: Officer");
    await expect(
      guest.getByRole("button", { name: /Promote|Demote|Remove|Close room/ }),
    ).toHaveCount(0);
    await guest.reload();
    await expect(guest.getByRole("status", { name: "Connection status" })).toHaveText("Connected");
    await expect(guest.getByText("Your role:")).toHaveText("Your role: Officer");
    await page.getByRole("button", { name: "Demote Officer Guest", exact: true }).click();
    await expect(guest.getByText("Your role:")).toHaveText("Your role: Participant");
    await expect(page.getByRole("status", { name: "Officer count" })).toHaveText("Officers: 0/3");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .exclude("nextjs-portal")
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remove Officer Guest", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Removed from room" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Participants (1/20)" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Close room", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Room closed" })).toBeVisible();
  } finally {
    await context.close();
  }
});
