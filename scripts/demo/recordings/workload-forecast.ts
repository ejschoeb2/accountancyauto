/**
 * Recording: Read the Workload Forecast
 *
 * Login, scroll to the Workload Forecast chart, toggle between timeframes
 * (This week, 4 weeks, 6 months, 12 months), and hover over individual bars
 * to show the deadline split tooltip. Pauses on each tooltip so viewers can
 * read the breakdown.
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
    "View the workload forecast chart, toggle timeframes (week/4wk/6mo/12mo), and hover over bars to see the deadline split.",
  tags: ["workload", "forecast", "chart", "dashboard", "planning", "timeframe"],
  category: "Dashboard",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);

    // ---- Scroll to Workload Forecast ----
    console.log("-> Scrolling to Workload Forecast...");
    const forecastHeader = page.locator('text=Workload Forecast').first();
    await forecastHeader.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Highlight the section ----
    await cursorMove(page, 'text=Workload Forecast');
    await wait(PAUSE.READ);

    // Helper: hover over bars using the invisible transparent rect targets.
    // These rects have onMouseEnter handlers — we need to use page.hover()
    // to trigger the React event, then move the fake cursor for visuals.
    const hoverBar = async (index: number) => {
      const target = page.locator("svg rect[fill='transparent']").nth(index);
      const box = await target.boundingBox();
      if (!box) return;

      // Move the real mouse to trigger onMouseEnter
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      // Move fake cursor to same spot
      await injectCursor(page);
      await page.evaluate(
        ({ x, y }) => {
          const el = document.getElementById('demo-cursor');
          if (el) { el.style.top = y + 'px'; el.style.left = x + 'px'; }
        },
        { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      );
      await wait(450);
    };

    // ---- Default view (6 months) — hover over bars ----
    console.log("-> Hovering over bars in default 6-month view...");
    const hoverTargets = page.locator("svg rect[fill='transparent']");
    let barCount = await hoverTargets.count();

    if (barCount > 0) {
      // Hover first bar
      console.log("-> Hovering over first bar...");
      await hoverBar(0);
      await wait(PAUSE.READ);

      // Hover a middle bar
      if (barCount > 2) {
        const midIndex = Math.floor(barCount / 2);
        console.log(`-> Hovering over bar ${midIndex + 1}...`);
        await hoverBar(midIndex);
        await wait(PAUSE.READ);
      }
    }

    // ---- Switch to "This week" ----
    // ToggleGroup renders plain <button> elements with text labels
    console.log("-> Switching to 'This week' timeframe...");
    const thisWeekBtn = page.locator('button:has-text("This week")').first();
    if (await thisWeekBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("This week")');
      await wait(PAUSE.LONG);

      barCount = await hoverTargets.count();
      if (barCount > 0) {
        await hoverBar(0);
        await wait(PAUSE.READ);
      }
    }

    // ---- Switch to "4 weeks" ----
    console.log("-> Switching to '4 weeks' timeframe...");
    const fourWeeksBtn = page.locator('button:has-text("4 weeks")').first();
    if (await fourWeeksBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("4 weeks")');
      await wait(PAUSE.LONG);

      barCount = await hoverTargets.count();
      if (barCount > 1) {
        console.log("-> Hovering over a bar in 4-week view...");
        await hoverBar(1);
        await wait(PAUSE.READ);
      } else if (barCount > 0) {
        await hoverBar(0);
        await wait(PAUSE.READ);
      }
    }

    // ---- Switch to "6 months" ----
    console.log("-> Switching to '6 months' timeframe...");
    const sixMonthsBtn = page.locator('button:has-text("6 months")').first();
    if (await sixMonthsBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("6 months")');
      await wait(PAUSE.LONG);

      barCount = await hoverTargets.count();
      if (barCount > 2) {
        await hoverBar(2);
        await wait(PAUSE.READ);
      }
    }

    // ---- Switch to "12 months" ----
    console.log("-> Switching to '12 months' timeframe...");
    const twelveMonthsBtn = page.locator('button:has-text("12 months")').first();
    if (await twelveMonthsBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("12 months")');
      await wait(PAUSE.LONG);

      barCount = await hoverTargets.count();
      if (barCount > 0) {
        // Hover first bar
        await hoverBar(0);
        await wait(PAUSE.READ);

        // Hover a later bar
        if (barCount > 4) {
          console.log("-> Hovering over a later bar in 12-month view...");
          await hoverBar(4);
          await wait(PAUSE.READ);
        }
      }
    }

    // ---- Return to default (6 months) ----
    console.log("-> Returning to '6 months' view...");
    if (await sixMonthsBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("6 months")');
      await wait(PAUSE.MEDIUM);
    }

    // Move mouse away from chart to dismiss any lingering tooltip
    await page.mouse.move(0, 0);
    await wait(PAUSE.SHORT);

    console.log("-> Workload Forecast demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
