/**
 * Recording: Generate a Client Portal Link
 *
 * On the client detail page, scroll to the Generate Upload Link section,
 * select a filing type, and click Generate Link.
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
  id: "generate-portal-link",
  title: "Generate a Client Portal Link",
  description:
    "Generate a secure, time-limited portal link for a client so they can upload documents directly.",
  tags: ["portal", "link", "upload", "client", "share", "secure"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management and find a Generate Upload Link button ----
    console.log("-> Scrolling to filing management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.scrollIntoViewIfNeeded();
    await wait(PAUSE.MEDIUM);

    // ---- Find and click Generate Upload Link on a filing card ----
    console.log("-> Looking for Generate Upload Link button...");
    const generateBtn = page
      .locator('button:has-text("Generate Upload Link"), button:has-text("Upload")')
      .first();

    if (await generateBtn.isVisible()) {
      await generateBtn.scrollIntoViewIfNeeded();
      await cursorMove(
        page,
        'button:has-text("Generate Upload Link"), button:has-text("Upload")'
      );
      await wait(PAUSE.MEDIUM);

      // Check if the button is disabled (portal may not be enabled)
      const isDisabled = await generateBtn.isDisabled().catch(() => false);
      if (!isDisabled) {
        console.log("-> Clicking Generate Upload Link...");
        await cursorClick(
          page,
          'button:has-text("Generate Upload Link"), button:has-text("Upload")'
        );
        await wait(PAUSE.LONG);

        // ---- Show the generated link ----
        console.log("-> Portal link generated — reviewing...");
        const portalUrlInput = page.locator('input[readonly][class*="font-mono"]');
        if (await portalUrlInput.isVisible()) {
          await cursorMove(page, 'input[readonly][class*="font-mono"]');
          await wait(PAUSE.READ);
        }
      } else {
        console.log("-> Generate Upload Link button is disabled (portal not enabled).");
        await wait(PAUSE.READ);
      }
    } else {
      console.log("-> No Generate Upload Link button found.");
      await cursorMove(page, '[id^="filing-"]');
    }

    await wait(PAUSE.READ);
    console.log("-> Generate portal link demo complete.");
  },
};

export default demo;
