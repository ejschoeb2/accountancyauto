/**
 * Recording: Connect Cloud Storage (Google Drive / OneDrive / Dropbox)
 *
 * Navigate to /settings, stay on General tab, view the Document Storage card,
 * hover over each provider's Connect button. Stops before the OAuth redirect.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "connect-storage",
  title: "Connect Cloud Storage (Google Drive / OneDrive / Dropbox)",
  description: "Link a cloud storage provider so client document uploads are automatically saved to your preferred service.",
  tags: ["storage", "google drive", "onedrive", "dropbox", "connect", "cloud", "settings"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── General tab is the default ───
    console.log("→ Scrolling to Document Storage card...");

    const storageHeading = page.locator('h2:has-text("Document Storage")');
    await storageHeading.scrollIntoViewIfNeeded();
    await wait(PAUSE.SHORT);

    await cursorMove(page, 'h2:has-text("Document Storage")');
    await wait(PAUSE.MEDIUM);

    // ─── View the privacy info box ───
    console.log("→ Viewing privacy information...");
    const privacyBox = page.locator('text="Prompt cannot access your other files."');
    if (await privacyBox.isVisible().catch(() => false)) {
      await cursorMove(page, 'text="Prompt cannot access your other files."');
      await wait(PAUSE.READ);
    }

    // ─── Browse providers ───
    console.log("→ Viewing Supabase Storage (built-in)...");
    await cursorMove(page, 'text="Supabase Storage"');
    await wait(PAUSE.SHORT);

    console.log("→ Viewing Google Drive option...");
    await cursorMove(page, 'text="Google Drive"');
    await wait(PAUSE.MEDIUM);

    // Hover over Google Drive Connect button
    const gdConnectBtn = page.locator('div:has(> div > p:has-text("Google Drive")) button:has-text("Connect")').first();
    if (await gdConnectBtn.isVisible().catch(() => false)) {
      await cursorMove(page, 'div:has(> div > p:has-text("Google Drive")) button:has-text("Connect")');
      await wait(PAUSE.SHORT);
    }

    console.log("→ Viewing Microsoft OneDrive option...");
    const oneDrive = page.locator('text="Microsoft OneDrive"');
    await oneDrive.scrollIntoViewIfNeeded();
    await cursorMove(page, 'text="Microsoft OneDrive"');
    await wait(PAUSE.MEDIUM);

    console.log("→ Viewing Dropbox option...");
    const dropbox = page.locator('text="Dropbox"');
    await dropbox.scrollIntoViewIfNeeded();
    await cursorMove(page, 'text="Dropbox"');
    await wait(PAUSE.MEDIUM);

    await wait(PAUSE.READ);
    console.log("→ Done — storage options viewed (stops before OAuth redirect).");
  },
};

export default demo;
