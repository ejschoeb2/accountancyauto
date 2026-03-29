/**
 * Recording: Read the Workload Forecast
 *
 * Login, scroll down to see the Workload Forecast chart fully, toggle
 * between timeframes, and hover smoothly over bars to show the status
 * split tooltips.
 */

import {
  type DemoDefinition,
  login,
  cursorClick,
  cursorMove,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "workload-forecast",
  title: "Read the Workload Forecast",
  description:
    "View the workload forecast chart, toggle timeframes (week/4wk/6mo/12mo), and hover over bars to see the status split — including green segments for completed filings.",
  tags: ["workload", "forecast", "chart", "dashboard", "planning", "timeframe", "status"],
  category: "Dashboard",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);

    // ---- Scroll down to see the full Workload Forecast ----
    console.log("-> Scrolling to Workload Forecast...");
    const forecastHeader = page.locator('text=Workload Forecast').first();
    await forecastHeader.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // Scroll a bit more to ensure the full chart is visible
    await page.evaluate(() => window.scrollBy(0, 200));
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    await cursorMove(page, 'text=Workload Forecast');
    await wait(PAUSE.MEDIUM);

    // Helper: hover over a bar smoothly using the transparent rect targets
    const hoverBar = async (index: number) => {
      const target = page.locator("svg rect[fill='transparent']").nth(index);
      const box = await target.boundingBox();
      if (!box) return;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await injectCursor(page);
      await page.evaluate(
        ({ x, y }) => {
          const el = document.getElementById('demo-cursor');
          if (el) { el.style.top = y + 'px'; el.style.left = x + 'px'; }
        },
        { x, y }
      );
      await wait(350);
    };

    const getBarCount = async () => {
      await wait(400);
      return page.locator("svg rect[fill='transparent']").count();
    };

    // ---- Default 6-month view — sweep across bars ----
    console.log("-> Hovering across bars in 6-month view...");
    let barCount = await getBarCount();

    if (barCount > 0) {
      await hoverBar(0);
      await wait(PAUSE.MEDIUM);

      // Sweep smoothly through bars
      for (let i = 1; i < Math.min(barCount, 6); i++) {
        await hoverBar(i);
        await wait(PAUSE.SHORT);
      }
      await wait(PAUSE.SHORT);
    }

    // ---- Switch to "This week" ----
    console.log("-> Switching to 'This week'...");
    const thisWeekBtn = page.locator('button:has-text("This week")').first();
    if (await thisWeekBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("This week")');
      barCount = await getBarCount();
      if (barCount > 0) {
        await hoverBar(0);
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Switch to "4 weeks" ----
    console.log("-> Switching to '4 weeks'...");
    const fourWeeksBtn = page.locator('button:has-text("4 weeks")').first();
    if (await fourWeeksBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("4 weeks")');
      barCount = await getBarCount();
      if (barCount > 0) {
        for (let i = 0; i < Math.min(barCount, 4); i++) {
          await hoverBar(i);
          await wait(PAUSE.SHORT);
        }
      }
    }

    // ---- Switch to "12 months" to show completed (green) bars ----
    console.log("-> Switching to '12 months'...");
    const twelveMonthsBtn = page.locator('button:has-text("12 months")').first();
    if (await twelveMonthsBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("12 months")');
      barCount = await getBarCount();
      if (barCount > 0) {
        // Sweep first few bars
        await hoverBar(0);
        await wait(PAUSE.MEDIUM);

        for (let i = 1; i < Math.min(barCount, 5); i++) {
          await hoverBar(i);
          await wait(PAUSE.SHORT);
        }

        // Jump to a later bar
        if (barCount > 8) {
          await hoverBar(barCount - 1);
          await wait(PAUSE.MEDIUM);
        }
      }
    }

    // ---- Return to default (6 months) ----
    console.log("-> Returning to '6 months'...");
    const sixMonthsBtn = page.locator('button:has-text("6 months")').first();
    if (await sixMonthsBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("6 months")');
      await wait(PAUSE.SHORT);
    }

    // Move mouse away to dismiss tooltip
    await page.mouse.move(0, 0);
    await wait(PAUSE.SHORT);

    console.log("-> Workload Forecast demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
