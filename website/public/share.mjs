import { getSharedItem } from '/share-links.mjs';
import { downloadConfig } from '/download-config.mjs';

const item = getSharedItem(window.location.pathname);
const title = document.getElementById('share-title');
const description = document.getElementById('share-description');
const button = document.getElementById('open-item');
const help = document.getElementById('share-help');
const download = document.getElementById('download-app');
if (item) {
  title.textContent = `A ${item.label} worth sharing.`;
  description.textContent = `Someone shared a ${item.label} with you on Novori. Open it in the app to explore it and join the conversation.`;
  document.title = `Shared ${item.label} · Novori`;
  button.href = item.appUrl;
  button.textContent = `Open ${item.label} in Novori`;
  button.hidden = false;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  let storeTimer;
  if (isIOS && downloadConfig.ios) {
    download.href = downloadConfig.ios;
    download.hidden = false;
    // Universal Links open an associated installed app before this page loads.
    // Visitors remaining on the browser fallback can go to the live listing.
    const openStore = () => {
      if (document.visibilityState === 'visible') window.location.replace(downloadConfig.ios);
    };
    storeTimer = window.setTimeout(openStore, 2500);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') window.clearTimeout(storeTimer);
    });
    window.addEventListener('pagehide', () => window.clearTimeout(storeTimer), { once: true });
  }
  button.addEventListener('click', () => {
    window.clearTimeout(storeTimer);
    help.hidden = false;
  });
} else {
  title.textContent = 'This link looks incomplete.';
  description.textContent = 'Ask the sender to share the book, post, or book stack again from Novori.';
  document.title = 'Link issue · Novori';
  help.hidden = false;
}
