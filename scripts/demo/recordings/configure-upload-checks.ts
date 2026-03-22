/**
 * Recording: Configure Upload Validation Checks
 *
 * Navigate to /settings, stay on General tab, find the Upload Checks card,
 * change the upload check mode dropdown.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "configure-upload-checks",
  title: "Configure Upload Validation Checks",
  description: "Set how document uploads are validated -- automatic acceptance, manual review, or rejection of mismatched files.",
  tags: ["upload", "validation", "checks", "settings", "auto", "manual", "review"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── General tab is the default ───
    console.log("→ Scrolling to Upload Checks card...");
    const heading = page.locator('h2:has-text("Upload Checks")');
    await heading.scrollIntoViewIfNeeded();
    await wait(PAUSE.SHORT);

    await cursorMove(page, 'h2:has-text("Upload Checks")');
    await wait(PAUSE.MEDIUM);

    // ─── Read the description ───
    console.log("→ Reading upload checks description...");
    await cursorMove(page, 'p:has-text("Control what processing runs")');
    await wait(PAUSE.READ);

    // ─── View privacy info ───
    console.log("→ Viewing data privacy info...");
    const privacyText = page.locator('strong:has-text("Your data stays private")');
    if (await privacyText.isVisible().catch(() => false)) {
      await cursorMove(page, 'strong:has-text("Your data stays private")');
      await wait(PAUSE.READ);
    }

    // ─── Open the upload check mode dropdown ───
    console.log("→ Opening upload check mode dropdown...");
    // The UploadChecksCard uses a Select with w-72 width
    await cursorClick(page, '.w-72[role="combobox"]');
    await wait(PAUSE.MEDIUM);

    // ─── Select "Verify uploads only" ───
    console.log("→ Selecting 'Verify uploads only'...");
    const verifyOption = page.locator('[role="option"]:has-text("Verify uploads only")');
    if (await verifyOption.isVisible()) {
      await cursorClick(page, '[role="option"]:has-text("Verify uploads only")');
    } else {
      await cursorClick(page, '[role="option"]', 1);
    }
    await wait(PAUSE.MEDIUM);

    // ─── Show the verify sub-options if they appear ───
    console.log("→ Viewing verification sub-options...");
    const rejectOption = page.locator('text="Reject mismatched HMRC documents"');
    if (await rejectOption.isVisible().catch(() => false)) {
      await cursorMove(page, 'text="Reject mismatched HMRC documents"');
      await wait(PAUSE.READ);
    }

    const autoConfirmOption = page.locator('text="Auto-confirm verified uploads"');
    if (await autoConfirmOption.isVisible().catch(() => false)) {
      await autoConfirmOption.scrollIntoViewIfNeeded();
      await cursorMove(page, 'text="Auto-confirm verified uploads"');
      await wait(PAUSE.READ);
    }

    console.log("→ Done — upload check mode changed.");
  },
};

export default demo;
