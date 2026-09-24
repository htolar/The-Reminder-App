// Closes distracting Chrome tabs when a grind session starts.
// Only does anything when running as a Chrome extension page; in a plain
// browser tab (no chrome.tabs API) it silently does nothing.

export const DEFAULT_BLOCKLIST = [
  'youtube.com', 'reddit.com', 'twitter.com', 'x.com', 'twitch.tv',
  'netflix.com', 'tiktok.com', 'instagram.com', 'facebook.com',
];

function isBlocked(url, list) {
  let host;
  try { host = new URL(url).hostname; } catch { return false; }
  return list.some((d) => host === d || host.endsWith('.' + d));
}

export async function closeDistractions() {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.storage) return;
  try {
    const { blocklist = DEFAULT_BLOCKLIST } = await chrome.storage.sync.get('blocklist');
    const me = await chrome.tabs.getCurrent();
    const tabs = await chrome.tabs.query({});
    const ids = tabs
      .filter((t) => (!me || t.id !== me.id) && t.url && isBlocked(t.url, blocklist))
      .map((t) => t.id);
    if (ids.length) await chrome.tabs.remove(ids);
  } catch (error) {
    // Never let a tab-closing failure break the app.
  }
}
