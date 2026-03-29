/**
 * Recording: Mark Records as Received
 *
 * Navigate to Brighton Digital LLP (approaching, not yet received),
 * scroll to filing management, find the CT600 filing card, tick each
 * document row in the checklist table individually with visible cursor,
 * showing the records being marked as received.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  cursorType,
  wait,
  PAUSE,
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "mark-records-received",
  title: "Mark Records as Received",
  description:
    "Tick individual document checkboxes on a filing card, toggle the overall 'Records Received' status, and see how it stops reminders for that filing.",
  tags: ["records", "received", "filing", "status", "client", "paperwork", "documents"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Search for Brighton Digital with visible cursor ----
    console.log("-> Searching for Brighton Digital LLP...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Brighton Digital");
    await wait(PAUSE.LONG);

    // ---- Click on the client row with visible cursor ----
    console.log("-> Clicking on Brighton Digital...");
    const clientRow = page.locator('table tbody tr').first();
    await clientRow.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL(/\/clients\/[a-f0-9-]+/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.waitFor({ state: "visible", timeout: 10000 });
    await filingSection.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Find the CT600 Filing card specifically ----
    console.log("-> Locating CT600 Filing card...");
    const ct600Card = page.locator('#filing-ct600_filing');
    await ct600Card.waitFor({ state: "visible", timeout: 10000 });
    await ct600Card.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // Show the filing card
    await cursorMove(page, '#filing-ct600_filing');
    await wait(PAUSE.READ);

    // ---- Tick individual document rows in the CT600 checklist table ----
    // The DocumentCard renders a table inside the filing card with checklist rows.
    // Each row is clickable — clicking it toggles manually_received.
    console.log("-> Looking for document checklist rows in the CT600 card...");
    const ct600Table = ct600Card.locator('table');
    await ct600Table.waitFor({ state: "visible", timeout: 10000 });
    await wait(PAUSE.MEDIUM);

    // Get all body rows (checklist items) — each has a CheckButton in first cell
    const checklistRows = ct600Card.locator('table tbody tr');
    const rowCount = await checklistRows.count();
    console.log(`-> Found ${rowCount} checklist rows — ticking each one...`);

    // Tick each row individually with visible cursor
    for (let i = 0; i < rowCount; i++) {
      const row = checklistRows.nth(i);
      await row.scrollIntoViewIfNeeded();
      await injectCursor(page);

      // Click the CheckButton in the first cell of this row
      const checkBtn = row.locator('button').first();
      if (await checkBtn.isVisible().catch(() => false)) {
        const box = await checkBtn.boundingBox();
        if (box) {
          // Move cursor to the checkbox
          await page.evaluate(
            ({ x, y }) => {
              const el = document.getElementById("demo-cursor");
              if (el) { el.style.top = y + "px"; el.style.left = x + "px"; }
            },
            { x: box.x + box.width / 2, y: box.y + box.height / 2 }
          );
          await wait(450);

          // Show click ripple
          await page.evaluate(`
            (() => {
              const cursor = document.getElementById('demo-cursor');
              if (!cursor) return;
              const ripple = document.createElement('div');
              Object.assign(ripple.style, {
                position: 'fixed',
                top: (parseFloat(cursor.style.top) + 4) + 'px',
                left: (parseFloat(cursor.style.left) + 4) + 'px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.4)',
                transform: 'scale(1)',
                transition: 'transform 0.35s ease-out, opacity 0.35s ease-out',
                pointerEvents: 'none', zIndex: '2147483646',
              });
              document.body.appendChild(ripple);
              requestAnimationFrame(() => { ripple.style.transform = 'scale(3)'; ripple.style.opacity = '0'; });
              setTimeout(() => ripple.remove(), 400);
            })();
          `);
          await wait(100);

          await checkBtn.click();
          console.log(`-> Ticked row ${i + 1} of ${rowCount}`);
          await wait(PAUSE.LONG);
        }
      }
    }

    // ---- Show the result — card should now show records received ----
    console.log("-> All documents ticked — showing updated status...");
    await ct600Card.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // The overall "X of Y required received" count should now be fully ticked
    // and records_received_for should be auto-set by onRequiredAllReceivedChange
    await cursorMove(page, '#filing-ct600_filing');
    await wait(PAUSE.READ);

    // Check if "Documents received" status text appeared
    const statusText = ct600Card.locator('text=Documents received');
    if (await statusText.isVisible().catch(() => false)) {
      await cursorMove(page, '#filing-ct600_filing span.text-violet-600');
      await wait(PAUSE.READ);
    }

    // ---- Show the toast / final result ----
    console.log("-> Giving time to show the result...");
    await wait(PAUSE.READ);

    console.log("-> Mark records received demo finished.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
