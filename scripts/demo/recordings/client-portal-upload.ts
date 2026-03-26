/**
 * Recording: Upload Documents via the Client Portal
 *
 * Instead of using a placeholder token (which shows "expired"), this script:
 *   1. Logs in as the demo user
 *   2. Navigates to a client detail page (Brighton Digital LLP)
 *   3. Clicks "Generate Upload Link" on one of the filing cards
 *   4. Copies the generated portal URL from the input field
 *   5. Opens that URL to show the real client portal with the upload checklist
 *   6. Browses the checklist items, progress bar, and upload UI
 *
 * Requires: seed-demo-data.ts to have created Brighton Digital LLP with
 * filing assignments (companies_house, etc.) and client_portal_enabled=true.
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
  BASE_URL,
} from "../helpers";

const demo: DemoDefinition = {
  id: "client-portal-upload",
  title: "Upload Documents via the Client Portal",
  description:
    "Generate a portal link from a client's page, then open it to see the client's view -- shows the upload checklist, drag-and-drop upload zones, progress bar, and document descriptions.",
  tags: [
    "portal",
    "upload",
    "client",
    "documents",
    "checklist",
    "drag drop",
    "generate link",
  ],
  category: "Client Portal",
  hasSideEffects: true,

  async record({ page, context }) {
    // ─── Step 1: Log in as the demo user ───
    await login(page);

    // ─── Step 2: Navigate to the clients list and find a client with portal enabled ───
    await navigateTo(page, "/clients");

    // ─── Step 3: Search for a client — try Brighton Digital first, fallback to Thames Valley ───
    console.log("-> Searching for a client to demonstrate portal upload...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });

    // Try Brighton Digital first
    await searchInput.fill("Brighton Digital");
    await wait(PAUSE.LONG);

    let foundClient = false;
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      const rowText = await firstRow.textContent().catch(() => "");
      if (rowText && rowText.includes("Brighton Digital")) {
        console.log("-> Found Brighton Digital — clicking...");
        await cursorClick(page, "table tbody tr", 0);
        await page.waitForURL(/\/clients\/[a-f0-9-]+/, { timeout: 15000 });
        foundClient = true;
      }
    }

    if (!foundClient) {
      // Fallback: try Thames Valley Consulting
      console.log("-> Brighton Digital not found — trying Thames Valley Consulting...");
      await searchInput.fill("Thames Valley");
      await wait(PAUSE.LONG);

      const fallbackRow = page.locator('table tbody tr').first();
      if (await fallbackRow.isVisible().catch(() => false)) {
        await cursorClick(page, "table tbody tr", 0);
        await page.waitForURL(/\/clients\/[a-f0-9-]+/, { timeout: 15000 });
        foundClient = true;
      }
    }

    if (!foundClient) {
      // Last resort: just click the first client in the unfiltered list
      console.log("-> Fallback — clicking first client in unfiltered list...");
      await searchInput.fill("");
      await wait(PAUSE.LONG);
      await cursorClick(page, "table tbody tr", 0);
      await page.waitForURL(/\/clients\/[a-f0-9-]+/, { timeout: 15000 });
    }

    // Wait for the client detail page to load
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── Step 4: Find a filing card and generate a portal upload link ───
    console.log("-> Looking for Generate Upload Link button...");
    // The filing management section has "Generate Upload Link" buttons per filing card
    const generateBtn = page.locator(
      'button:has-text("Generate Upload Link"), button:has-text("Upload")'
    );
    await generateBtn.first().waitFor({ timeout: 15000 });

    // Scroll the first filing card into view
    await generateBtn.first().scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // Click the "Generate Upload Link" button
    console.log("-> Clicking Generate Upload Link...");
    await cursorClick(
      page,
      'button:has-text("Generate Upload Link"), button:has-text("Upload")'
    );

    // Wait for the portal URL to appear in an input field
    // The DocumentCard shows the portal URL in a read-only input with font-mono class
    console.log("-> Waiting for portal URL to be generated...");
    const portalInput = page.locator(
      'input.font-mono[readonly]'
    );
    await portalInput.first().waitFor({ timeout: 15000 });
    await wait(PAUSE.MEDIUM);

    // Hover over the generated URL to show it
    await portalInput.first().scrollIntoViewIfNeeded();
    await cursorMove(page, 'input.font-mono[readonly]');
    await wait(PAUSE.READ);

    // Extract the portal URL from the input field
    const portalUrl = await portalInput.first().inputValue();
    console.log(`-> Portal URL: ${portalUrl}`);

    if (!portalUrl || !portalUrl.includes("/portal/")) {
      console.log("-> Failed to get portal URL — ending early.");
      await wait(PAUSE.READ);
      return;
    }

    // ─── Step 5: Open the portal URL in a new page ───
    console.log("-> Opening portal URL...");
    // Open in the same page (simulates clicking the link as a client would)
    const portalPage = await context.newPage();
    await portalPage.goto(portalUrl);
    await portalPage.waitForLoadState("networkidle");
    await injectCursor(portalPage);
    await wait(PAUSE.LONG);

    // ─── Step 6: View the portal page ───

    // Check if we landed on the checklist or an error page
    const expiredMessage = portalPage.locator(
      'text="This link has expired", text="This link has been revoked"'
    );
    const isError = await expiredMessage.first().isVisible().catch(() => false);

    if (isError) {
      console.log("-> Portal link is expired/revoked — showing error state...");
      await cursorMove(portalPage, ".rounded-xl");
      await wait(PAUSE.READ);
      await portalPage.close();
      return;
    }

    // View the header — shows Prompt logo + org name + "Secure upload" badge
    console.log("-> Viewing portal header...");
    const secureUploadBadge = portalPage.locator(
      'span:has-text("Secure upload")'
    );
    if (await secureUploadBadge.isVisible().catch(() => false)) {
      await cursorMove(portalPage, 'span:has-text("Secure upload")');
      await wait(PAUSE.MEDIUM);
    }

    // View the main heading (e.g. "Companies House Accounts document upload")
    const uploadHeading = portalPage.locator("h1");
    if (await uploadHeading.isVisible().catch(() => false)) {
      await cursorMove(portalPage, "h1");
      await wait(PAUSE.MEDIUM);
    }

    // View the "Uploading for [client name]" subtitle
    const clientSubtitle = portalPage.locator(
      'p:has-text("Uploading for")'
    );
    if (await clientSubtitle.isVisible().catch(() => false)) {
      await cursorMove(portalPage, 'p:has-text("Uploading for")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── View the progress bar ───
    console.log("-> Viewing progress bar...");
    const progressSection = portalPage.locator(
      '[role="progressbar"], .rounded-full'
    );
    if (await progressSection.first().isVisible().catch(() => false)) {
      await cursorMove(
        portalPage,
        '[role="progressbar"], .rounded-full'
      );
      await wait(PAUSE.MEDIUM);
    }

    // ─── Browse checklist items ───
    console.log("-> Browsing document checklist...");
    // Each checklist item is a card with a document label and an Upload button
    const checklistItems = portalPage.locator(
      ".bg-white.rounded-xl.border.shadow-sm.p-4"
    );
    const itemCount = await checklistItems.count();

    for (let i = 0; i < Math.min(itemCount, 5); i++) {
      console.log(`-> Viewing checklist item ${i + 1}...`);
      const item = checklistItems.nth(i);
      await item.scrollIntoViewIfNeeded();
      await injectCursor(portalPage);

      // Hover over the document label
      const label = item.locator(".text-sm.font-medium").first();
      if (await label.isVisible().catch(() => false)) {
        const box = await label.boundingBox();
        if (box) {
          await portalPage.evaluate(
            ({ x, y }) => {
              const el = document.getElementById("demo-cursor");
              if (el) {
                el.style.top = y + "px";
                el.style.left = x + "px";
              }
            },
            { x: box.x + box.width / 2, y: box.y + box.height / 2 }
          );
          await wait(450);
        }
      }
      await wait(PAUSE.MEDIUM);

      // Check for a description under the label
      const desc = item.locator(".text-xs.text-muted-foreground").first();
      if (await desc.isVisible().catch(() => false)) {
        const descBox = await desc.boundingBox();
        if (descBox) {
          await portalPage.evaluate(
            ({ x, y }) => {
              const el = document.getElementById("demo-cursor");
              if (el) {
                el.style.top = y + "px";
                el.style.left = x + "px";
              }
            },
            { x: descBox.x + descBox.width / 2, y: descBox.y + descBox.height / 2 }
          );
          await wait(450);
        }
        await wait(PAUSE.SHORT);
      }
    }

    // ─── View optional documents section if present ───
    const optionalHeading = portalPage.locator(
      'h2:has-text("Optional documents")'
    );
    if (await optionalHeading.isVisible().catch(() => false)) {
      console.log("-> Viewing optional documents section...");
      await optionalHeading.scrollIntoViewIfNeeded();
      await injectCursor(portalPage);
      await cursorMove(portalPage, 'h2:has-text("Optional documents")');
      await wait(PAUSE.READ);
    }

    // ─── View footer ───
    const footerText = portalPage.locator('text="Powered by Prompt"');
    if (await footerText.isVisible().catch(() => false)) {
      console.log("-> Viewing footer...");
      await footerText.scrollIntoViewIfNeeded();
      await injectCursor(portalPage);
      await cursorMove(portalPage, 'text="Powered by Prompt"');
      await wait(PAUSE.MEDIUM);
    }

    await wait(PAUSE.READ);
    console.log("-> Done — client portal upload UI demonstrated.");

    // Close the portal tab
    await portalPage.close();
  },
};

export default demo;
