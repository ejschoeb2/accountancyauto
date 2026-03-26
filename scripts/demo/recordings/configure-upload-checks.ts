/**
 * Recording: Configure Upload Validation Checks
 *
 * Navigate to /settings, stay on General tab, find the Upload Checks card.
 * Demonstrates all four upload check modes and the two sub-options that
 * appear when verification is enabled:
 *
 *   Modes:
 *   - "Verify & extract metadata" (both) — full processing
 *   - "Verify uploads only" (verify) — flags mismatches but no OCR
 *   - "Extract metadata only" (extract) — OCR but no mismatch detection
 *   - "No processing" (none) — filename keywords only
 *
 *   Sub-options (visible when mode includes verification):
 *   - "Reject mismatched HMRC documents" — auto-reject wrong tax year P60/P45/SA302
 *   - "Auto-confirm verified uploads" — mark verified uploads as received automatically
 *
 * Also shows the data privacy info banner and the "Test uploads" button.
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
    "Set how document uploads are validated -- choose from four processing modes (verify & extract, verify only, extract only, or none), then configure sub-options like rejecting mismatched HMRC documents and auto-confirming verified uploads.",
  tags: [
    "upload",
    "validation",
    "checks",
    "settings",
    "auto",
    "manual",
    "review",
    "reject",
    "verify",
    "extract",
    "metadata",
    "OCR",
  ],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── General tab is the default ───
    console.log("-> Scrolling to Upload Checks card...");
    const heading = page.locator('h2:has-text("Upload Checks")');
    await heading.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // ─── View the card heading ───
    await cursorMove(page, 'h2:has-text("Upload Checks")');
    await wait(PAUSE.MEDIUM);

    // ─── Read the description explaining what upload checks do ───
    console.log("-> Reading upload checks description...");
    const descText = page.locator(
      'p:has-text("Control what processing runs")'
    );
    if (await descText.isVisible().catch(() => false)) {
      await cursorMove(page, 'p:has-text("Control what processing runs")');
      await wait(PAUSE.READ);
    }

    // ─── View the data privacy info banner ───
    console.log("-> Viewing data privacy info...");
    const privacyBanner = page.locator(
      'strong:has-text("Your data stays private")'
    );
    if (await privacyBanner.isVisible().catch(() => false)) {
      await cursorMove(page, 'strong:has-text("Your data stays private")');
      await wait(PAUSE.READ);
    }

    // ─── Show the "Test uploads" button if visible ───
    const testUploadsBtn = page.locator('a:has-text("Test uploads")');
    if (await testUploadsBtn.isVisible().catch(() => false)) {
      console.log("-> Showing Test uploads button...");
      await cursorMove(page, 'a:has-text("Test uploads")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Open the main mode dropdown ───
    // The UploadChecksCard uses a SelectTrigger with w-72 class directly on the button
    console.log('-> Opening upload check mode dropdown...');
    await cursorClick(page, 'button[role="combobox"].w-72');
    await wait(PAUSE.MEDIUM);

    // ─── Show all four options by hovering ───
    console.log('-> Viewing all mode options...');
    const optionLabels = [
      "Verify & extract metadata",
      "Verify uploads only",
      "Extract metadata only",
      "No processing",
    ];
    for (const label of optionLabels) {
      const opt = page.locator(`[role="option"]:has-text("${label}")`);
      if (await opt.isVisible().catch(() => false)) {
        await cursorMove(page, `[role="option"]:has-text("${label}")`);
        await wait(PAUSE.SHORT);
      }
    }

    // ─── Select "Verify & extract metadata" (the fullest mode) ───
    console.log('-> Selecting "Verify & extract metadata"...');
    const bothOption = page.locator(
      '[role="option"]:has-text("Verify & extract metadata")'
    );
    if (await bothOption.isVisible()) {
      await cursorClick(
        page,
        '[role="option"]:has-text("Verify & extract metadata")'
      );
    } else {
      await cursorClick(page, '[role="option"]', 0);
    }
    await wait(PAUSE.MEDIUM);

    // ─── Wait for Saved indicator ───
    const savedIndicator = page.locator('text="Saved"');
    await savedIndicator
      .waitFor({ timeout: 5000 })
      .catch(() => {});
    await wait(PAUSE.SHORT);

    // ─── Show the "Reject mismatched HMRC documents" sub-option ───
    console.log("-> Viewing reject mismatched HMRC documents option...");
    const rejectHeading = page.locator(
      'p:has-text("Reject mismatched HMRC documents")'
    );
    if (await rejectHeading.isVisible().catch(() => false)) {
      await rejectHeading.scrollIntoViewIfNeeded();
      await cursorMove(
        page,
        'p:has-text("Reject mismatched HMRC documents")'
      );
      await wait(PAUSE.READ);

      // Read the description underneath
      const rejectDesc = page.locator(
        'p:has-text("portal uploads of HMRC documents")'
      );
      if (await rejectDesc.isVisible().catch(() => false)) {
        await cursorMove(
          page,
          'p:has-text("portal uploads of HMRC documents")'
        );
        await wait(PAUSE.READ);
      }

      // Toggle it to Enabled
      console.log("-> Enabling reject mismatched uploads...");
      const rejectSelect = rejectHeading
        .locator("xpath=ancestor::div[contains(@class,'space-y')]")
        .locator('button[role="combobox"].w-56');
      if (await rejectSelect.isVisible().catch(() => false)) {
        await rejectSelect.click();
        await wait(PAUSE.SHORT);
        const enabledOption = page.locator(
          '[role="option"]:has-text("Enabled (reject wrong documents)")'
        );
        if (await enabledOption.isVisible().catch(() => false)) {
          await cursorClick(
            page,
            '[role="option"]:has-text("Enabled (reject wrong documents)")'
          );
          await wait(PAUSE.MEDIUM);
        }
      }
    }

    // ─── Show the "Auto-confirm verified uploads" sub-option ───
    console.log("-> Viewing auto-confirm verified uploads option...");
    const autoConfirmHeading = page.locator(
      'p:has-text("Auto-confirm verified uploads")'
    );
    if (await autoConfirmHeading.isVisible().catch(() => false)) {
      await autoConfirmHeading.scrollIntoViewIfNeeded();
      await cursorMove(
        page,
        'p:has-text("Auto-confirm verified uploads")'
      );
      await wait(PAUSE.READ);

      // Read the description underneath
      const autoDesc = page.locator(
        'p:has-text("Verified")'
      );
      if (await autoDesc.first().isVisible().catch(() => false)) {
        await cursorMove(page, 'p:has-text("pending for manual confirmation")');
        await wait(PAUSE.READ);
      }

      // Toggle it to Enabled
      console.log("-> Enabling auto-confirm...");
      const autoSelect = autoConfirmHeading
        .locator("xpath=ancestor::div[contains(@class,'space-y')]")
        .locator('button[role="combobox"].w-56');
      if (await autoSelect.isVisible().catch(() => false)) {
        await autoSelect.click();
        await wait(PAUSE.SHORT);
        const enabledOption = page.locator(
          '[role="option"]:has-text("Enabled")'
        );
        if (await enabledOption.isVisible().catch(() => false)) {
          await cursorClick(
            page,
            '[role="option"]:has-text("Enabled")',
            0
          );
          await wait(PAUSE.MEDIUM);
        }
      }
    }

    // ─── Brief pause on the final state ───
    console.log("-> Done — all upload check options demonstrated.");
    await wait(PAUSE.READ);
  },
};

export default demo;
