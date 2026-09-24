// User-adjustable settings: which sites are managed, and how each one behaves.
//
// Each site is { host, mode }:
//   host: "poki.com"  -> that site and all of its subdomains
//         "*game"      -> any site whose hostname contains "game" (wildcard)
//   mode: "block"      -> closed the instant it's opened
//         "checkin"    -> left open, but after checkInMinutes we ask "are you being productive?"

export const DEFAULT_SITES = [
  // wildcards: catch crazygames.com, coolmathgames.com, unblocked-games sites, etc.
  { host: '*game', mode: 'block' },
  { host: '*unblocked', mode: 'block' },
  // game portals (poki and similar)
  { host: 'poki.com', mode: 'block' },
  { host: 'poki-gdn.com', mode: 'block' },
  { host: 'crazygames.com', mode: 'block' },
  { host: 'miniclip.com', mode: 'block' },
  { host: 'y8.com', mode: 'block' },
  { host: 'kongregate.com', mode: 'block' },
  { host: 'newgrounds.com', mode: 'block' },
  { host: 'armorgames.com', mode: 'block' },
  { host: 'addictinggames.com', mode: 'block' },
  { host: 'friv.com', mode: 'block' },
  { host: 'kizi.com', mode: 'block' },
  { host: 'silvergames.com', mode: 'block' },
  { host: 'agame.com', mode: 'block' },
  { host: 'coolmathgames.com', mode: 'block' },
  { host: 'gamepix.com', mode: 'block' },
  { host: 'gamedistribution.com', mode: 'block' },
  { host: 'twoplayergames.org', mode: 'block' },
  { host: 'itch.io', mode: 'block' },
  { host: 'now.gg', mode: 'block' },
  { host: 'papergames.io', mode: 'block' },
  // launchers / platforms
  { host: 'roblox.com', mode: 'block' },
  { host: 'steampowered.com', mode: 'block' },
  { host: 'epicgames.com', mode: 'block' },
  // popular .io games
  { host: 'krunker.io', mode: 'block' },
  { host: 'slither.io', mode: 'block' },
  { host: 'agar.io', mode: 'block' },
  { host: 'surviv.io', mode: 'block' },
  { host: 'shellshock.io', mode: 'block' },
  { host: 'skribbl.io', mode: 'block' },
  { host: 'diep.io', mode: 'block' },
  { host: 'zombs.io', mode: 'block' },
  { host: 'bonk.io', mode: 'block' },
  { host: 'smashkarts.io', mode: 'block' },
  { host: 'venge.io', mode: 'block' },
  // video / social — allowed, but nagged after checkInMinutes
  { host: 'youtube.com', mode: 'checkin' },
  { host: 'reddit.com', mode: 'checkin' },
  { host: 'twitter.com', mode: 'checkin' },
  { host: 'x.com', mode: 'checkin' },
  { host: 'twitch.tv', mode: 'checkin' },
  { host: 'netflix.com', mode: 'checkin' },
  { host: 'tiktok.com', mode: 'checkin' },
  { host: 'instagram.com', mode: 'checkin' },
  { host: 'facebook.com', mode: 'checkin' },
];

export const DEFAULT_CHECKIN_MINUTES = 60;

const LS_KEY = 'reminder-app.settings.v2';
const hasSync = () => typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

function normalizeSites(value) {
  if (!Array.isArray(value)) return DEFAULT_SITES;
  const cleaned = value
    .map((entry) => ({
      host: String(entry?.host ?? '').trim().toLowerCase(),
      mode: entry?.mode === 'checkin' ? 'checkin' : 'block',
    }))
    .filter((entry) => entry.host);
  return cleaned.length ? cleaned : DEFAULT_SITES;
}

export async function getSettings() {
  let stored = {};
  try {
    stored = hasSync()
      ? await chrome.storage.sync.get(['sites', 'checkInMinutes'])
      : JSON.parse(window.localStorage.getItem(LS_KEY) || '{}');
  } catch (error) {
    stored = {};
  }
  return {
    sites: normalizeSites(stored.sites),
    checkInMinutes:
      Number.isFinite(stored.checkInMinutes) && stored.checkInMinutes > 0
        ? stored.checkInMinutes
        : DEFAULT_CHECKIN_MINUTES,
  };
}

export async function saveSettings({ sites, checkInMinutes }) {
  const payload = { sites: normalizeSites(sites), checkInMinutes };
  if (hasSync()) {
    await chrome.storage.sync.set(payload);
  } else {
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }
}

export async function resetSettings() {
  if (hasSync()) {
    await chrome.storage.sync.remove(['sites', 'checkInMinutes']);
  } else {
    window.localStorage.removeItem(LS_KEY);
  }
}