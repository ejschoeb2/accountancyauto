/**
 * Recording: Override a Filing Deadline
 *
 * Navigate to "Brighton Digital LLP" (approaching deadline status, not yet
 * overdue/complete), scroll to filing management, click Override Deadline on
 * a filing card, enter a new date and reason, and save.
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
  id: "override-deadline",
  title: "Override a Filing Deadline",
  description:
    "Set a custom deadline date for a specific filing, overriding the auto-calculated date. Choose a client with an approaching deadline.",
  tags: ["deadline", "override", "custom date", "filing", "client"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Search for Brighton Digital LLP (approaching deadline) ----
    console.log("-> Searching for Brighton Digital LLP...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("Brighton Digital");
    await wait(PAUSE.LONG);

    // ---- Navigate to client detail page ----
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

    // ---- Find an Override Deadline button ----
    // The Override Deadline button appears on filing cards that don't have
    // records received and don't have an existing override
    console.log("-> Looking for Override Deadline button...");
    const overrideBtn = page.locator('button:has-text("Override Deadline")').first();

    // Wait for filing cards to load
    await page.locator('[id^="filing-"]').first().waitFor({ state: "visible", timeout: 10000 });

    if (await overrideBtn.isVisible().catch(() => false)) {
      // Scroll the button into view
      await overrideBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);

      // Show the filing card before clicking
      console.log("-> Showing filing card with approaching deadline...");
      await cursorMove(page, 'button:has-text("Override Deadline")');
      await wait(PAUSE.READ);

      // ---- Click Override Deadline ----
      console.log("-> Clicking Override Deadline...");
      await overrideBtn.click();
      await wait(PAUSE.MEDIUM);
    } else {
      // If no Override Deadline button, the filing may already have an override
      // Try removing it first or look at another card
      console.log("-> No Override Deadline button found — checking other filing cards...");
      const allCards = page.locator('[id^="filing-"]');
      const count = await allCards.count();
      for (let i = 0; i < count; i++) {
        const card = allCards.nth(i);
        const cardOverrideBtn = card.locator('button:has-text("Override Deadline")');
        if (await cardOverrideBtn.isVisible().catch(() => false)) {
          await cardOverrideBtn.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await cardOverrideBtn.click();
          await wait(PAUSE.MEDIUM);
          break;
        }
      }
    }

    // ---- Fill in the override dialog ----
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    console.log("-> Override dialog open — entering new deadline...");
    await wait(PAUSE.SHORT);

    // Enter override date (use the #override-date input)
    const dateInput = dialog.locator('#override-date');
    if (await dateInput.isVisible().catch(() => false)) {
      await cursorClick(page, '[role="dialog"] #override-date');
      await dateInput.fill("2026-09-30");
      await wait(PAUSE.MEDIUM);
    } else {
      // Fallback: any date input in the dialog
      const anyDateInput = dialog.locator('input[type="date"]');
      if (await anyDateInput.isVisible().catch(() => false)) {
        await cursorClick(page, '[role="dialog"] input[type="date"]');
        await anyDateInput.fill("2026-09-30");
        await wait(PAUSE.MEDIUM);
      }
    }

    // Enter reason (use the #override-reason input)
    const reasonInput = dialog.locator('#override-reason');
    if (await reasonInput.isVisible().catch(() => false)) {
      await cursorType(
        page,
        '[role="dialog"] #override-reason',
        "Client requested extension due to audit",
        { delay: 25 }
      );
      await wait(PAUSE.MEDIUM);
    } else {
      // Fallback
      const anyTextInput = dialog.locator('input[type="text"], textarea');
      if (await anyTextInput.isVisible().catch(() => false)) {
        await cursorType(
          page,
          '[role="dialog"] input[type="text"], [role="dialog"] textarea',
          "Client requested extension due to audit",
          { delay: 25 }
        );
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Review the dialog ----
    console.log("-> Reviewing override before saving...");
    await cursorMove(page, '[role="dialog"]');
    await wait(PAUSE.READ);

    // ---- Save the override ----
    console.log("-> Saving deadline override...");
    const saveBtn = dialog.locator('button:has-text("Save Override")');
    if (await saveBtn.isVisible().catch(() => false)) {
      await cursorClick(page, '[role="dialog"] button:has-text("Save Override")');
    } else {
      // Fallback
      const altSaveBtn = dialog.locator('button:has-text("Save"), button:has-text("Override")');
      if (await altSaveBtn.isVisible().catch(() => false)) {
        await altSaveBtn.first().click();
      }
    }
    await wait(PAUSE.LONG);

    // ---- Show the result — filing card now shows "Overridden" badge ----
    console.log("-> Override saved — reviewing result...");
    await wait(PAUSE.MEDIUM);

    // The filing card should now show the overridden deadline
    const overriddenBadge = page.locator('text=Overridden').first();
    if (await overriddenBadge.isVisible().catch(() => false)) {
      await cursorMove(page, 'text=Overridden');
      await wait(PAUSE.READ);
    }

    console.log("-> Deadline override demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
