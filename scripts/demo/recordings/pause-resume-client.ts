/**
 * Recording: Pause & Resume a Client's Reminders
 *
 * Navigate to Northern Logistics Group's detail page (Limited Company),
 * pause reminders, then resume them.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorType,
  cursorMove,
  wait,
  PAUSE,
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "pause-resume-client",
  title: "Pause & Resume a Client's Reminders",
  description:
    "Pause all automated reminders for a client from their detail page, then resume them.",
  tags: ["pause", "resume", "reminders", "stop", "client", "inactive"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Ensure "Limited Company" type is selected ----
    await page.waitForLoadState("networkidle");
    const lcToggle = page.locator('button:has-text("Limited Company")');
    await lcToggle.waitFor({ state: "visible", timeout: 10000 });
    await cursorClick(page, 'button:has-text("Limited Company")');
    await wait(PAUSE.SHORT);

    // ---- Search for Northern Logistics ----
    console.log("-> Searching for Northern Logistics...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 15000 });
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Northern Logistics", { delay: 25 });
    await wait(PAUSE.LONG);

    // ---- Click on the client name ----
    console.log("-> Opening client detail page...");
    const clientNameCell = page.locator('td:has(> span.text-muted-foreground)').first();
    await clientNameCell.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'td:has(> span.text-muted-foreground)', 0);
    await page.waitForURL(/\/clients\/[a-f0-9-]+/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Pause Reminders ----
    console.log("-> Clicking Pause Reminders...");
    await page.locator('button:has-text("Pause Reminders")').waitFor({ state: "visible", timeout: 10000 });
    await cursorMove(page, 'button:has-text("Pause Reminders")');
    await wait(PAUSE.MEDIUM);
    await cursorClick(page, 'button:has-text("Pause Reminders")');

    // Wait for button to swap to Resume
    await page.locator('button:has-text("Resume Reminders")').waitFor({ state: "visible", timeout: 30000 });
    await injectCursor(page);
    await wait(PAUSE.READ);

    // ---- Resume Reminders ----
    console.log("-> Clicking Resume Reminders...");
    await cursorMove(page, 'button:has-text("Resume Reminders")');
    await wait(PAUSE.MEDIUM);
    await cursorClick(page, 'button:has-text("Resume Reminders")');

    // Wait for button to swap back to Pause
    await page.locator('button:has-text("Pause Reminders")').waitFor({ state: "visible", timeout: 30000 });
    await injectCursor(page);
    await wait(PAUSE.READ);

    console.log("-> Done.");
  },
};

export default demo;
