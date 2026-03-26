/**
 * Recording: Generate a Client Portal Link
 *
 * Navigate to "Oakwood Property Management Ltd" (approaching, has records
 * received for corp tax — so it has document requirements), scroll to filing
 * management, and generate an upload link for a filing type that has
 * document requirements.
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

    // ---- Search for Oakwood Property Management (has document requirements) ----
    console.log("-> Searching for Oakwood Property Management...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("Oakwood");
    await wait(PAUSE.LONG);

    // ---- Navigate to client detail page ----
    console.log("-> Clicking on Oakwood Property Management...");
    const clientRow = page.locator('table tbody tr').first();
    await clientRow.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to filing management...");
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
        await wait(PAUSE.MEDIUM);

        // Show the button before clicking
        await cursorMove(page, `button:has-text("Generate Upload Link") >> nth=${i}`);
        await wait(PAUSE.READ);

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
      console.log("-> All Generate Upload Link buttons are disabled (no document requirements).");
      await cursorMove(page, '[id^="filing-"]');
      await wait(PAUSE.READ);
      return;
    }

    // ---- Show the generated link ----
    console.log("-> Portal link generated — reviewing...");
    await wait(PAUSE.MEDIUM);

    // The portal URL should appear in a read-only input with font-mono class
    const portalUrlInput = page.locator('input[readonly]').first();
    if (await portalUrlInput.isVisible().catch(() => false)) {
      await portalUrlInput.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, 'input[readonly]');
      await wait(PAUSE.READ);
    }

    // Look for copy button or expiry info
    const expiryText = page.locator('text=Expires').first();
    if (await expiryText.isVisible().catch(() => false)) {
      await cursorMove(page, 'text=Expires');
      await wait(PAUSE.READ);
    }

    console.log("-> Generate portal link demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
