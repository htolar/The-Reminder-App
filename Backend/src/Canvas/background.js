import { matchSite } from './src/focus.js';
import { getSettings } from './src/settings.js';

const APP_URL = () => chrome.runtime.getURL('index.html');
const APP_WINDOW_SIZE = { width: 420, height: 760 };

// ---- Toolbar icon: open the app as its own small window (not a browser tab) ----
// A dedicated popup-type window feels like a real app rather than another tab,
// and — unlike an action-bar dropdown popup — it stays open while you work.
chrome.action.onClicked.addListener(async () => {
  const { appWindowId } = await chrome.storage.local.get('appWindowId');
  if (appWindowId != null) {
    try {
      await chrome.windows.update(appWindowId, { focused: true });
      return;
    } catch (error) {
      // Window is gone; fall through and open a fresh one.
    }
  }
  const win = await chrome.windows.create({
    url: APP_URL(),
    type: 'popup',
    ...APP_WINDOW_SIZE,
  });
  await chrome.storage.local.set({ appWindowId: win.id });
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { appWindowId } = await chrome.storage.local.get('appWindowId');
  if (appWindowId === windowId) await chrome.storage.local.remove('appWindowId');
});

// ---- Sites set to "block": closed the instant they're opened or navigated to ----
async function enforce(tab) {
  if (!tab || !tab.id) return;
  const url = tab.url || tab.pendingUrl;
  if (!url) return;
  const { sites } = await getSettings();
  const match = matchSite(url, sites);
  if (match && match.mode === 'block') chrome.tabs.remove(tab.id).catch(() => {});
}
chrome.tabs.onCreated.addListener(enforce);
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'loading') enforce(tab);
});

chrome.runtime.onStartup.addListener(() =>
  chrome.storage.local.set({ blockedMinutes: 0, checkin: null })
);

// ---- Sites set to "checkin": after N minutes, ask "are you being productive?" ----
// Once a minute, if you are actively using Chrome and the tab you are looking
// at is a "checkin" site, that minute is counted. At the limit, a small window
// asks whether you are being productive; "No" closes the site.
async function tick() {
  const { checkin } = await chrome.storage.local.get('checkin');
  if (checkin) return; // a prompt is already open

  if ((await chrome.idle.queryState(300)) !== 'active') return; // away from the computer
  const win = await chrome.windows.getLastFocused();
  if (!win || !win.focused) return; // Chrome isn't the window you're using
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab || !tab.url) return;

  const { sites, checkInMinutes } = await getSettings();
  const match = matchSite(tab.url, sites);
  if (!match || match.mode !== 'checkin') return;

  const { blockedMinutes = 0 } = await chrome.storage.local.get('blockedMinutes');
  const minutes = blockedMinutes + 1;
  if (minutes < checkInMinutes) {
    await chrome.storage.local.set({ blockedMinutes: minutes });
    return;
  }
  await chrome.storage.local.set({ blockedMinutes: 0 });
  await openCheckin(tab, checkInMinutes);
}

async function openCheckin(tab, minutes) {
  const host = new URL(tab.url).hostname;
  const params = new URLSearchParams({ tab: String(tab.id), host, mins: String(minutes) });
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(`checkin.html?${params}`),
    type: 'popup',
    width: 440,
    height: 280,
    focused: true,
  });
  await chrome.storage.local.set({ checkin: { windowId: win.id, tabId: tab.id, answered: false } });
}

// Closing the prompt without answering = "ask me again in ~5 minutes".
chrome.windows.onRemoved.addListener(async (windowId) => {
  const { checkin } = await chrome.storage.local.get('checkin');
  if (!checkin || checkin.windowId !== windowId) return;
  await chrome.storage.local.set({ checkin: null });
  if (!checkin.answered) {
    const { checkInMinutes } = await getSettings();
    await chrome.storage.local.set({ blockedMinutes: Math.max(0, checkInMinutes - 5) });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tick') tick();
});
chrome.alarms.get('tick').then((existing) => {
  if (!existing) chrome.alarms.create('tick', { periodInMinutes: 1 });
});