import { getSharedItem } from '/share-links.mjs';

const item = getSharedItem(window.location.pathname);
const title = document.getElementById('share-title');
const description = document.getElementById('share-description');
const button = document.getElementById('open-item');
const help = document.getElementById('share-help');
if (item) {
  title.textContent = `A ${item.label} worth sharing.`;
  description.textContent = `Someone shared a ${item.label} with you on Novori. Open it in the app to explore it and join the conversation.`;
  document.title = `Shared ${item.label} · Novori`;
  button.href = item.appUrl;
  button.textContent = `Open ${item.label} in Novori`;
  button.hidden = false;
  button.addEventListener('click', () => { help.hidden = false; });
} else {
  title.textContent = 'This link looks incomplete.';
  description.textContent = 'Ask the sender to share the book, post, or book stack again from Novori.';
  document.title = 'Link issue · Novori';
  help.hidden = false;
}
