/**
 * Recording: Upload Documents via the Client Portal
 *
 * Navigate directly to a portal URL, view the upload checklist,
 * show the drag-and-drop UI for each checklist item.
 * Since we cannot generate a real portal token in a demo, this script
 * navigates to the portal path and demonstrates the UI layout.
 */

import {
  type DemoDefinition,
  BASE_URL,
  injectCursor,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "client-portal-upload",
  title: "Upload Documents via the Client Portal",
  description: "Open a portal link as a client and upload documents -- shows the checklist, drag-and-drop upload, progress, and validation feedback.",
  tags: ["portal", "upload", "client", "documents", "checklist", "drag drop"],
  category: "Client Portal",
  hasSideEffects: true,

  async record({ page }) {
    // ─── Navigate to a demo portal link ───
    // In a real scenario this would be /portal/{token}
    // For demo purposes we use a placeholder token that shows the expired/revoked UI
    // or a pre-seeded demo token if available
    console.log("→ Opening client portal link...");
    const demoToken = process.env.DEMO_PORTAL_TOKEN || "demo-token-placeholder";
    await page.goto(`${BASE_URL}/portal/${demoToken}`);
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── Check if we landed on the checklist or the expired page ───
    const expiredMessage = page.locator('text="This link has expired"');
    const revokedMessage = page.locator('text="This link has been revoked"');
    const isExpired = await expiredMessage.isVisible().catch(() => false);
    const isRevoked = await revokedMessage.isVisible().catch(() => false);

    if (isExpired || isRevoked) {
      console.log("→ Portal link is expired/revoked — showing the error state...");
      await cursorMove(page, '.rounded-xl');
      await wait(PAUSE.READ);

      console.log("→ This is what clients see when a link expires.");
      await wait(PAUSE.READ);
      console.log("→ Done — expired portal state shown.");
      return;
    }

    // ─── View the header ───
    console.log("→ Viewing portal header...");
    await cursorMove(page, 'text="Secure upload"');
    await wait(PAUSE.MEDIUM);

    // ─── View the document upload heading ───
    const uploadHeading = page.locator('h1');
    if (await uploadHeading.isVisible()) {
      await cursorMove(page, 'h1');
      await wait(PAUSE.MEDIUM);
    }

    // ─── View the progress bar (required documents) ───
    console.log("→ Viewing progress bar...");
    const progressBar = page.locator('[role="progressbar"], .rounded-full.bg-secondary').first();
    if (await progressBar.isVisible().catch(() => false)) {
      await cursorMove(page, '[role="progressbar"], .rounded-full.bg-secondary');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Browse checklist items ───
    console.log("→ Browsing document checklist...");
    const checklistCards = page.locator('.rounded-xl.border.shadow-sm.p-4');
    const itemCount = await checklistCards.count();

    for (let i = 0; i < Math.min(itemCount, 4); i++) {
      console.log(`→ Viewing checklist item ${i + 1}...`);
      await cursorMove(page, '.rounded-xl.border.shadow-sm.p-4', i);
      await wait(PAUSE.MEDIUM);

      // Hover over the Upload button for this item
      const uploadBtn = checklistCards.nth(i).locator('text="Upload"');
      if (await uploadBtn.isVisible().catch(() => false)) {
        await cursorMove(page, '.rounded-xl.border.shadow-sm.p-4 >> text="Upload"', i);
        await wait(PAUSE.SHORT);
      }
    }

    // ─── View optional documents section if present ───
    const optionalHeading = page.locator('h2:has-text("Optional documents")');
    if (await optionalHeading.isVisible().catch(() => false)) {
      console.log("→ Viewing optional documents section...");
      await optionalHeading.scrollIntoViewIfNeeded();
      await cursorMove(page, 'h2:has-text("Optional documents")');
      await wait(PAUSE.READ);
    }

    // ─── View footer ───
    console.log("→ Viewing footer...");
    const footer = page.locator('text="Powered by Prompt"');
    if (await footer.isVisible().catch(() => false)) {
      await footer.scrollIntoViewIfNeeded();
      await cursorMove(page, 'text="Powered by Prompt"');
      await wait(PAUSE.MEDIUM);
    }

    await wait(PAUSE.READ);
    console.log("→ Done — client portal upload UI viewed.");
  },
};

export default demo;
