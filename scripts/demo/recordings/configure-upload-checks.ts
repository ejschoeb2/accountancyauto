/**
 * Recording: Configure Upload Validation Checks
 *
 * Navigate to /settings, scroll down past Client Portal to the Upload
 * Checks card, and interact with all three dropdowns within that card.
 * Never touches the Client Portal section.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "configure-upload-checks",
  title: "Configure Upload Validation Checks",
  description:
    "Set how document uploads are validated -- choose a processing mode, configure rejection of mismatched documents, and auto-confirmation of verified uploads.",
  tags: ["upload", "validation", "checks", "settings", "verify", "extract", "metadata"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── Immediately scroll down to Upload Checks (past Client Portal) ───
    console.log("-> Scrolling to Upload Checks card...");
    const uploadChecksHeading = page.locator('h2:has-text("Upload Checks")');
    // Scroll the page down to ensure Upload Checks is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await injectCursor(page);
    await wait(PAUSE.SHORT);
    await uploadChecksHeading.waitFor({ state: "visible", timeout: 10000 });
    await uploadChecksHeading.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // Point at the heading
    await cursorMove(page, 'h2:has-text("Upload Checks")');
    await wait(PAUSE.MEDIUM);

    // Scope all interactions to the Upload Checks card
    const card = uploadChecksHeading.locator('xpath=ancestor::*[contains(@class,"card")]').first();

    // ─── Dropdown 1: Main mode ───
    console.log("-> Opening upload check mode dropdown...");
    const allDropdowns = card.locator('button[role="combobox"]');
    const modeDropdown = allDropdowns.first();
    await modeDropdown.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await cursorMove(page, '#filing-upload-check-mode, h2:has-text("Upload Checks")');
    await wait(PAUSE.SHORT);
    await modeDropdown.click();
    await wait(PAUSE.SHORT);

    // Select "Verify & extract metadata"
    console.log('-> Selecting "Verify & extract metadata"...');
    const bothOption = page.locator('[role="option"]:has-text("Verify & extract metadata")');
    if (await bothOption.isVisible()) {
      await cursorClick(page, '[role="option"]:has-text("Verify & extract metadata")');
    } else {
      await cursorClick(page, '[role="option"]', 0);
    }
    await wait(PAUSE.SHORT);

    // ─── Dropdown 2: Reject mismatched HMRC documents ───
    // Re-query dropdowns since sub-options may have appeared
    console.log("-> Opening Reject mismatched HMRC documents dropdown...");
    const updatedDropdowns = card.locator('button[role="combobox"]');
    const dropdownCount = await updatedDropdowns.count();

    if (dropdownCount > 1) {
      const rejectDropdown = updatedDropdowns.nth(1);
      await rejectDropdown.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await rejectDropdown.click();
      await wait(PAUSE.SHORT);

      const enabledOption = page.locator('[role="option"]:has-text("Enabled")').first();
      if (await enabledOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Enabled")');
      }
      await wait(PAUSE.SHORT);
    }

    // ─── Dropdown 3: Auto-confirm verified uploads ───
    const finalDropdowns = card.locator('button[role="combobox"]');
    const finalCount = await finalDropdowns.count();

    if (finalCount > 2) {
      console.log("-> Opening Auto-confirm verified uploads dropdown...");
      const autoDropdown = finalDropdowns.nth(2);
      await autoDropdown.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await autoDropdown.click();
      await wait(PAUSE.SHORT);

      const enabledOption = page.locator('[role="option"]:has-text("Enabled")').first();
      if (await enabledOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Enabled")');
      }
      await wait(PAUSE.SHORT);
    }

    console.log("-> Done — all upload check options configured.");
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
