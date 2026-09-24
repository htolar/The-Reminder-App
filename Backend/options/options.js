const DEFAULTS = ['youtube.com','reddit.com','twitter.com','x.com','twitch.tv','netflix.com','tiktok.com','instagram.com','facebook.com'];
const box = document.getElementById('list');
chrome.storage.sync.get('blocklist').then(({ blocklist = DEFAULTS }) => { box.value = blocklist.join('\n'); });
document.getElementById('save').onclick = async () => {
  const list = box.value.split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean);
  await chrome.storage.sync.set({ blocklist: list });
  document.getElementById('msg').textContent = 'Saved';
};
