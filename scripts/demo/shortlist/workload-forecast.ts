/**
 * Shortlist recording: Workload Forecast
 *
 * Smooth-scroll to the forecast chart, toggle timeframes, hover over bars
 * with fluid mouse movement, then scroll back to dashboard top.
 */

import {
  type DemoDefinition,
  login,
  cursorClick,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "shortlist-workload-forecast",
  title: "Workload Forecast",
  description: "Toggle timeframes and hover over chart bars to see deadline splits.",
  tags: ["workload", "forecast", "chart", "dashboard"],
  category: "Dashboard",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);

    // ── Smooth scroll to Workload Forecast section ─────────────────────────
    await page.locator('text=Workload Forecast').first().evaluate((el) => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    await wait(PAUSE.LONG);
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // Helper: smoothly move cursor to a bar and show its tooltip
    const hoverBar = async (index: number) => {
      const target = page.locator("svg rect[fill='transparent']").nth(index);
      const box = await target.boundingBox();
      if (!box) return;
      const destX = box.x + box.width / 2;
      const destY = box.y + box.height / 2;
      // Smooth mouse movement via steps
      await page.mouse.move(destX, destY, { steps: 30 });
      // Sync the fake cursor overlay
      await page.evaluate(
        ({ x, y }) => {
          const el = document.getElementById("demo-cursor");
          if (el) { el.style.left = x + "px"; el.style.top = y + "px"; }
        },
        { x: destX, y: destY }
      );
      await wait(600);
    };

    // Default view (6 months) — sweep across a few bars
    const hoverTargets = page.locator("svg rect[fill='transparent']");
    let barCount = await hoverTargets.count();

    if (barCount > 0) {
      // Move through bars 0, 1, 2 smoothly
      for (let i = 0; i < Math.min(3, barCount); i++) {
        await hoverBar(i);
        await wait(PAUSE.SHORT);
      }
      await wait(PAUSE.READ);
    }

    // Switch to "This week"
    const thisWeekBtn = page.locator('button:has-text("This week")').first();
    if (await thisWeekBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("This week")');
      await wait(PAUSE.LONG);
      barCount = await hoverTargets.count();
      for (let i = 0; i < Math.min(2, barCount); i++) {
        await hoverBar(i);
        await wait(PAUSE.SHORT);
      }
      await wait(PAUSE.READ);
    }

    // Switch to "4 weeks"
    const fourWeeksBtn = page.locator('button:has-text("4 weeks")').first();
    if (await fourWeeksBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("4 weeks")');
      await wait(PAUSE.LONG);
      barCount = await hoverTargets.count();
      for (let i = 0; i < Math.min(3, barCount); i++) {
        await hoverBar(i);
        await wait(PAUSE.SHORT);
      }
      await wait(PAUSE.READ);
    }

    // Switch to "12 months"
    const twelveMonthsBtn = page.locator('button:has-text("12 months")').first();
    if (await twelveMonthsBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("12 months")');
      await wait(PAUSE.LONG);
      barCount = await hoverTargets.count();
      if (barCount > 0) {
        await hoverBar(0);
        await wait(PAUSE.READ);
      }
    }

    // Return to default (6 months)
    const sixMonthsBtn = page.locator('button:has-text("6 months")').first();
    if (await sixMonthsBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("6 months")');
      await wait(PAUSE.MEDIUM);
    }

    // Move mouse away before scroll
    await page.mouse.move(0, 0, { steps: 20 });
    await wait(PAUSE.SHORT);

    // ── Scroll back to top ─────────────────────────────────────────────────
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await wait(PAUSE.LONG);
  },
};

export default demo;
