// Tab blocking helpers. Only do anything inside the Chrome extension (they need
// chrome.tabs / chrome.storage); in a plain browser tab they silently do nothing.

import { getSettings } from './settings.js';

const hasChrome = () => typeof chrome !== 'undefined' && chrome.tabs && chrome.storage;

// Returns the matching site entry ({ host, mode }) for a URL, or null.
export function matchSite(url, sites) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  return (
    sites.find((entry) =>
      entry.host.startsWith('*')
        ? host.includes(entry.host.slice(1))
        : host === entry.host || host.endsWith('.' + entry.host)
    ) || null
  );
}

// Tells the background worker whether a GRIND session is running. Blocking and
// check-ins only ever happen while this is true — see background.js.
export async function setGrindActive(active) {
  if (!hasChrome()) return;
  try {
    await chrome.storage.local.set({ grindActive: active, blockedMinutes: 0 });
  } catch (error) {}
}

// Closes every currently-open tab whose site is set to "block" (except this app's own tab).
// "checkin" sites are left alone — they're tracked on a timer instead, see background.js.
export async function closeDistractions() {
  if (!hasChrome()) return;
  try {
    const { sites } = await getSettings();
    const me = await chrome.tabs.getCurrent();
    const tabs = await chrome.tabs.query({});
    const ids = tabs
      .filter((t) => {
        if (me && t.id === me.id) return false;
        if (!t.url) return false;
        const match = matchSite(t.url, sites);
        return match && match.mode === 'block';
      })
      .map((t) => t.id);
    if (ids.length) await chrome.tabs.remove(ids);
  } catch (error) {
    // Never let a tab-closing failure break the app.
  }
}