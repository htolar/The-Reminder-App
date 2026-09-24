const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tab'));
const host = params.get('host') || 'this site';
const mins = params.get('mins') || '60';

const unit = mins === '1' ? 'minute' : 'minutes';
document.getElementById('msg').textContent =
  `You've spent about ${mins} ${unit} on ${host}. Is this productive right now?`;

async function finish(closeSite) {
  try {
    if (closeSite && Number.isFinite(tabId)) await chrome.tabs.remove(tabId);
  } catch (error) {
    // The tab may already be gone.
  }
  const { checkin } = await chrome.storage.local.get('checkin');
  if (checkin) await chrome.storage.local.set({ checkin: { ...checkin, answered: true } });
  const current = await chrome.windows.getCurrent();
  chrome.windows.remove(current.id);
}

document.getElementById('yes').addEventListener('click', () => finish(false));
document.getElementById('no').addEventListener('click', () => finish(true));