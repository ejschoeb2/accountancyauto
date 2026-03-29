/**
 * Recording: Generate a Client Portal Link
 *
 * Navigate to the clients table, click on a client (not Oakwood — use a
 * different one), scroll to Filing Management, and generate an upload link.
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

    // ---- Click on a client from the table ----
    console.log("-> Clicking on a client...");
    const clientNameCell = page.locator('td:has(> span.text-muted-foreground)').first();
    await clientNameCell.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'td:has(> span.text-muted-foreground)', 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to filing management...");
    // Scroll down to ensure the section is in the viewport
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await injectCursor(page);
    await wait(PAUSE.SHORT);
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.waitFor({ state: "visible", timeout: 10000 });
    await filingSection.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Wait for filing cards to load ----
    await page.locator('[id^="filing-"]').first().waitFor({ state: "visible", timeout: 10000 });
    await wait(PAUSE.MEDIUM);

    // ---- Find a Generate Upload Link button that is enabled ----
    console.log("-> Looking for an enabled Generate Upload Link button...");
    const generateBtns = page.locator('button:has-text("Generate Upload Link")');
    const btnCount = await generateBtns.count();

    let clickedBtn = false;
    for (let i = 0; i < btnCount; i++) {
      const btn = generateBtns.nth(i);
      const isDisabled = await btn.isDisabled().catch(() => true);
      if (!isDisabled) {
        await btn.scrollIntoViewIfNeeded();
        await injectCursor(page);
        await wait(PAUSE.SHORT);

        // Show the button before clicking
        await cursorMove(page, `button:has-text("Generate Upload Link") >> nth=${i}`);
        await wait(PAUSE.MEDIUM);

        // Click to generate the link
        console.log("-> Clicking Generate Upload Link...");
        await btn.click();
        await wait(PAUSE.LONG);
        clickedBtn = true;
        break;
      }
    }

    if (!clickedBtn) {
      // Fallback: try clicking the short "Upload" text variant (mobile)
      const uploadBtns = page.locator('button:has-text("Upload")');
      const uploadCount = await uploadBtns.count();
      for (let i = 0; i < uploadCount; i++) {
        const btn = uploadBtns.nth(i);
        const isDisabled = await btn.isDisabled().catch(() => true);
        if (!isDisabled && await btn.isVisible().catch(() => false)) {
          await btn.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await btn.click();
          await wait(PAUSE.LONG);
          clickedBtn = true;
          break;
        }
      }
    }

    if (!clickedBtn) {
      console.log("-> All Generate Upload Link buttons are disabled.");
      await cursorMove(page, '[id^="filing-"]');
      await wait(PAUSE.READ);
      return;
    }

    // ---- Show the generated link ----
    console.log("-> Portal link generated — reviewing...");
    await wait(PAUSE.MEDIUM);

    // The portal URL should appear in a read-only input
    const portalUrlInput = page.locator('input[readonly]').first();
    if (await portalUrlInput.isVisible().catch(() => false)) {
      await portalUrlInput.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, 'input[readonly]');
      await wait(PAUSE.READ);
    }

    // Look for expiry info
    const expiryText = page.locator('text=Expires').first();
    if (await expiryText.isVisible().catch(() => false)) {
      await cursorMove(page, 'text=Expires');
      await wait(PAUSE.MEDIUM);
    }

    console.log("-> Generate portal link demo complete.");
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
