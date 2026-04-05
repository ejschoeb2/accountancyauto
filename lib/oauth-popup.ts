/**
 * OAuth popup utility — opens the OAuth flow in a centered popup window
 * instead of a full-page redirect. Falls back to full-page redirect if
 * the popup is blocked by the browser.
 *
 * The popup navigates through the provider's consent screen and lands on
 * /oauth-complete, which posts the result back via window.postMessage
 * and closes itself.
 */

type OAuthResult = {
  connected?: string | null;
  error?: string | null;
};

/**
 * Opens an OAuth flow in a popup window.
 *
 * @param url  The connect URL (e.g. "/api/auth/google-drive/connect")
 *             — `popup=1` is appended automatically.
 * @param onComplete  Called with { connected, error } when the popup finishes.
 * @returns A cleanup function, or null if the popup was blocked (falls back
 *          to full-page redirect in that case).
 */
export function openOAuthPopup(
  url: string,
  onComplete: (result: OAuthResult) => void,
): (() => void) | null {
  const width = 500;
  const height = 700;
  const left = Math.round(window.screenX + (window.innerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.innerHeight - height) / 2);

  const popupUrl = `${url}${url.includes("?") ? "&" : "?"}popup=1`;

  const popup = window.open(
    popupUrl,
    "oauth-popup",
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
  );

  // Popup blocked — fall back to full-page redirect (without popup=1)
  if (!popup) {
    window.location.href = url;
    return null;
  }

  function handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== "oauth-complete") return;
    cleanup();
    onComplete({ connected: event.data.connected, error: event.data.error });
  }

  const timer = setInterval(() => {
    if (popup.closed) {
      cleanup();
    }
  }, 500);

  function cleanup() {
    clearInterval(timer);
    window.removeEventListener("message", handleMessage);
  }

  window.addEventListener("message", handleMessage);

  return cleanup;
}
