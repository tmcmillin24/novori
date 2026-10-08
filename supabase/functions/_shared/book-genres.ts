// Display/classification vocabulary, not a translation or a plot-based guess.
// Unknown library subject headings are omitted instead of shown as genres.
const labels = [
 'LitRPG', 'Progression Fantasy', 'Epic Fantasy', 'Romantic Fantasy', 'Dark Fantasy', 'Urban Fantasy', 'Cozy Fantasy', 'Historical Fantasy', 'Fantasy',
 'Space Opera', 'Military Science Fiction', 'Dystopian', 'Cyberpunk', 'Science Fiction',
 'Contemporary Romance', 'Historical Romance', 'Paranormal Romance', 'Romantic Suspense', 'Romance',
 'Cozy Mystery', 'Crime', 'Mystery', 'Psychological Thriller', 'Thriller', 'Horror',
 'Historical Fiction', 'Literary Fiction', 'Adventure', 'Young Adult', "Children's Books",
 'Biography', 'Memoir', 'History', 'Self-Help', 'Business', 'Science', 'Religion', 'Spirituality',
 'Poetry', 'Comics', 'Graphic Novels', 'Nonfiction',
];
const key = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases: Record<string,string> = { 'science fiction':'Science Fiction', 'sci fi':'Science Fiction', 'litrpg':'LitRPG', 'lit rpg':'LitRPG', 'romantasy':'Romantic Fantasy', 'high fantasy':'Epic Fantasy', 'juvenile fiction':"Children's Books", 'children s fiction':"Children's Books", 'children s books':"Children's Books", 'juvenile nonfiction':"Children's Books", 'young adult fiction':'Young Adult', 'comics graphic novels':'Graphic Novels', 'non fiction':'Nonfiction' };
export function normalizeBookGenres(values: unknown): string[] {
 if (!Array.isArray(values)) return [];
 const result: string[] = [];
 for (const value of values) {
  if (typeof value !== 'string') continue;
  const text = key(value);
  const exact = aliases[text] ?? labels.find(label => key(label) === text);
  const found = exact ? [exact] : labels.filter(label => new RegExp(`(?:^| )${key(label)}(?: |$)`).test(text));
  for (const label of found) {
   if (label === 'Science' && (found.includes('Science Fiction') || /social science|political science|library science/.test(text))) continue;
   if (!result.includes(label)) result.push(label);
  }
 }
 return result.slice(0, 8);
}
