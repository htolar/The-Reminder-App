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

// ---- GRIND is only "running" while the app is really open ----
// Blocking and check-ins must never happen when the app isn't open. The app tells
// us when GRIND starts/stops (grindActive), but a crash, a closed window, or an
// extension reload could leave that flag stuck on — so every time we're about to
// act on it we also confirm the app's page is still open somewhere.
async function appIsOpen() {
  const base = APP_URL();
  const tabs = await chrome.tabs.query({});
  return tabs.some((t) => (t.url || t.pendingUrl || '').startsWith(base));
}

async function endGrind() {
  const { checkin } = await chrome.storage.local.get('checkin');
  await chrome.storage.local.set({ grindActive: false, blockedMinutes: 0 });
  if (checkin && checkin.windowId != null) {
    chrome.windows.remove(checkin.windowId).catch(() => {});
  }
}

async function grindRunning() {
  const { grindActive } = await chrome.storage.local.get('grindActive');
  if (!grindActive) return false;
  if (await appIsOpen()) return true;
  await endGrind(); // flag was stale: the app is closed, so nothing should be blocked
  return false;
}

// App window closed -> GRIND is over.
chrome.windows.onRemoved.addListener(async (windowId) => {
  const { appWindowId } = await chrome.storage.local.get('appWindowId');
  if (appWindowId === windowId) {
    await chrome.storage.local.remove('appWindowId');
    await endGrind();
  }
});

// Any tab closing (e.g. the app opened in a normal tab): re-check that the app is still open.
chrome.tabs.onRemoved.addListener(async () => {
  const { grindActive } = await chrome.storage.local.get('grindActive');
  if (grindActive) await grindRunning();
});

// ---- Sites set to "Block": closed the instant they're opened or navigated to ----
// Only while a GRIND session is running — see setGrindActive() in src/focus.js.
async function enforce(tab) {
  if (!tab || !tab.id) return;
  const url = tab.url || tab.pendingUrl;
  if (!url) return;
  if (!(await grindRunning())) return;
  const { sites } = await getSettings();
  const match = matchSite(url, sites);
  if (match && match.mode === 'block') chrome.tabs.remove(tab.id).catch(() => {});
}
chrome.tabs.onCreated.addListener(enforce);
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'loading') enforce(tab);
});

// Browser start or extension reload/update: no session can be running yet.
const resetSession = () =>
  chrome.storage.local.set({ grindActive: false, blockedMinutes: 0, checkin: null });
chrome.runtime.onStartup.addListener(resetSession);
chrome.runtime.onInstalled.addListener(resetSession);

// ---- Sites set to "Check-in": after N minutes, ask "are you being productive?" ----
// Also only while a GRIND session is running. Once a minute, if you are actively
// using Chrome and the tab you are looking at is a "Check-in" site, that minute
// is counted. At the limit, a small window asks whether you are being productive;
// "No" closes the site.
async function tick() {
  const { checkin } = await chrome.storage.local.get('checkin');
  if (checkin) return; // a prompt is already open
  if (!(await grindRunning())) return; // nothing to track outside GRIND

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