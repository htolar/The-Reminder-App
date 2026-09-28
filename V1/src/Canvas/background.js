// Chrome extension service worker.
// This file is intentionally inside src/Canvas, so all imports below are
// relative to this file's location.

importScripts('../../options/settings.js', '../src/focus.js');

const APP_URL = () => chrome.runtime.getURL('index.html');

const APP_WINDOW_SIZE = {
  width: 420,
  height: 760,
};

// ============================================================
// TOOLBAR BUTTON
// ============================================================

chrome.action.onClicked.addListener(async () => {
  const { appWindowId } = await chrome.storage.local.get('appWindowId');

  if (appWindowId != null) {
    try {
      await chrome.windows.update(appWindowId, {
        focused: true,
      });

      return;
    } catch (error) {
      // Window no longer exists.
    }
  }

  const win = await chrome.windows.create({
    url: APP_URL(),
    type: 'popup',
    ...APP_WINDOW_SIZE,
  });

  await chrome.storage.local.set({
    appWindowId: win.id,
  });
});

// ============================================================
// CHECK WHETHER THE APP IS ACTUALLY OPEN
// ============================================================

async function appIsOpen() {
  const base = APP_URL();

  const tabs = await chrome.tabs.query({});

  return tabs.some((tab) => {
    const url = tab.url || tab.pendingUrl || '';
    return url.startsWith(base);
  });
}

// ============================================================
// END GRIND
// ============================================================

async function endGrind() {
  const { checkin } = await chrome.storage.local.get('checkin');

  await chrome.storage.local.set({
    grindActive: false,
    blockedMinutes: 0,
  });

  if (checkin && checkin.windowId != null) {
    chrome.windows.remove(checkin.windowId).catch(() => {});
  }
}

async function grindRunning() {
  const { grindActive } = await chrome.storage.local.get('grindActive');

  if (!grindActive) {
    return false;
  }

  if (await appIsOpen()) {
    return true;
  }

  await endGrind();

  return false;
}

// ============================================================
// APP WINDOW CLOSED
// ============================================================

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { appWindowId } = await chrome.storage.local.get('appWindowId');

  if (appWindowId === windowId) {
    await chrome.storage.local.remove('appWindowId');
    await endGrind();
  }
});

// ============================================================
// TAB CLOSED
// ============================================================

chrome.tabs.onRemoved.addListener(async () => {
  const { grindActive } = await chrome.storage.local.get('grindActive');

  if (grindActive) {
    await grindRunning();
  }
});

// ============================================================
// BLOCK SITES
// ============================================================

async function enforce(tab) {
  if (!tab || !tab.id) {
    return;
  }

  const url = tab.url || tab.pendingUrl;

  if (!url) {
    return;
  }

  if (!(await grindRunning())) {
    return;
  }

  const { sites } = await getSettings();

  const match = matchSite(url, sites);

  if (match && match.mode === 'block') {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.tabs.onCreated.addListener(enforce);

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'loading') {
    enforce(tab);
  }
});

// ============================================================
// RESET SESSION WHEN CHROME STARTS / EXTENSION UPDATES
// ============================================================

const resetSession = () =>
  chrome.storage.local.set({
    grindActive: false,
    blockedMinutes: 0,
    checkin: null,
  });

chrome.runtime.onStartup.addListener(resetSession);

chrome.runtime.onInstalled.addListener(resetSession);

// ============================================================
// CHECK-IN SITES
// ============================================================

async function tick() {
  const { checkin } = await chrome.storage.local.get('checkin');

  if (checkin) {
    return;
  }

  if (!(await grindRunning())) {
    return;
  }

  const idleState = await chrome.idle.queryState(300);

  if (idleState !== 'active') {
    return;
  }

  const win = await chrome.windows.getLastFocused();

  if (!win || !win.focused) {
    return;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    windowId: win.id,
  });

  if (!tab || !tab.url) {
    return;
  }

  const { sites, checkInMinutes } = await getSettings();

  const match = matchSite(tab.url, sites);

  if (!match || match.mode !== 'checkin') {
    return;
  }

  const {
    blockedMinutes = 0,
  } = await chrome.storage.local.get('blockedMinutes');

  const minutes = blockedMinutes + 1;

  if (minutes < checkInMinutes) {
    await chrome.storage.local.set({
      blockedMinutes: minutes,
    });

    return;
  }

  await chrome.storage.local.set({
    blockedMinutes: 0,
  });

  await openCheckin(tab, checkInMinutes);
}

// ============================================================
// OPEN CHECK-IN WINDOW
// ============================================================

async function openCheckin(tab, minutes) {
  const host = new URL(tab.url).hostname;

  const params = new URLSearchParams({
    tab: String(tab.id),
    host,
    mins: String(minutes),
  });

  // IMPORTANT:
  // checkin.html is inside /options, not the root folder.
  const checkinUrl = chrome.runtime.getURL(
    `options/checkin.html?${params}`
  );

  const win = await chrome.windows.create({
    url: checkinUrl,
    type: 'popup',
    width: 440,
    height: 280,
    focused: true,
  });

  await chrome.storage.local.set({
    checkin: {
      windowId: win.id,
      tabId: tab.id,
      answered: false,
    },
  });
}

// ============================================================
// CHECK-IN WINDOW CLOSED
// ============================================================

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { checkin } = await chrome.storage.local.get('checkin');

  if (!checkin || checkin.windowId !== windowId) {
    return;
  }

  await chrome.storage.local.set({
    checkin: null,
  });

  if (!checkin.answered) {
    const { checkInMinutes } = await getSettings();

    await chrome.storage.local.set({
      blockedMinutes: Math.max(
        0,
        checkInMinutes - 5
      ),
    });
  }
});

// ============================================================
// TIMER
// ============================================================

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tick') {
    tick();
  }
});

chrome.alarms.get('tick').then((existing) => {
  if (!existing) {
    chrome.alarms.create('tick', {
      periodInMinutes: 1,
    });
  }
});