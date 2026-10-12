import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

test("invitation, live presence, reconnect, tab takeover, leave and host closure", async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  await page.getByLabel("Display name", { exact: false }).fill("Room Host");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(page.getByRole("status", { name: "Connection status" })).toHaveText("Connected");
  const invite = page.url();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  try {
    await guest.goto(invite);
    await guest.getByLabel("Display name", { exact: false }).fill("Guest Listener");
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(guest.getByRole("status", { name: "Connection status" })).toHaveText("Connected");
    await expect(page.getByRole("heading", { name: "Participants (2/20)" })).toBeVisible();
    await expect(guest.getByRole("button", { name: "Close room" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("status", { name: "Connection status" })).toHaveText("Connected");
    await expect(page.getByRole("button", { name: "Close room" })).toBeEnabled();
    await guestContext.setOffline(true);
    await expect(guest.getByRole("status", { name: "Connection status" })).toContainText(
      "Disconnected",
    );
    await guestContext.setOffline(false);
    await expect(guest.getByRole("status", { name: "Connection status" })).toHaveText("Connected", {
      timeout: 15_000,
    });
    const otherTab = await guestContext.newPage();
    await otherTab.goto(invite);
    await expect(otherTab.getByRole("status", { name: "Connection status" })).toHaveText(
      "Connected",
    );
    await guest.bringToFront();
    await expect(guest.getByRole("heading", { name: "Active in another tab" })).toBeVisible();
    await page.bringToFront();
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("nextjs-portal")
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("room.png"),
      fullPage: true,
      caret: "initial",
    });
    await otherTab.bringToFront();
    await otherTab.getByRole("button", { name: "Leave room" }).click();
    await expect(otherTab.getByRole("heading", { name: "You left the room" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Participants (1/20)" })).toBeVisible();
    await guest.bringToFront();
    await guest.reload();
    await guest.getByLabel("Display name", { exact: false }).fill("Returning Guest");
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(guest.getByRole("status", { name: "Connection status" })).toHaveText("Connected");
    await expect(page.getByRole("heading", { name: "Participants (2/20)" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.bringToFront();
    await page.getByRole("button", { name: "Close room" }).click();
    await expect(guest.getByRole("heading", { name: "Room closed" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Room closed" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await guestContext.close();
  }
});
