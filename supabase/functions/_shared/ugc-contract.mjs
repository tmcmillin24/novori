// Shared by the native transport, Edge gateway, and regression tests.
export const UGC_TABLE_FIELDS = {
  posts: ['body', 'post_image_url', 'book_title', 'book_authors', 'book_series_name', 'book_cover_url'],
  post_comments: ['body'],
  profiles: ['username', 'display_name', 'bio', 'avatar_url'],
  user_books: ['review_text', 'title', 'authors', 'cover_url'],
  book_stacks: ['name', 'description'],
  book_stack_items: ['title', 'authors', 'cover_url'],
  club_reads: ['note', 'book'],
  clubs: ['name', 'description', 'rules', 'cover_url'],
  club_discussions: ['title', 'prompt', 'options', 'spoiler_label', 'book'],
  club_events: ['title', 'description', 'location', 'meeting_url', 'book'],
};
export const UGC_RPC_FIELDS = {
  novori_save_book_stack: ['p_name', 'p_items', 'p_body'],
  create_post_comment: ['comment_body'],
  update_post_comment: ['comment_body'],
  save_club_discussion: ['discussion_input'],
  save_club_event: ['event_input'],
  save_club_read: ['read_input'],
  publish_reading_update: ['post_body'],
  publish_reading_update_to_destination: ['post_body'],
  publish_reading_recap_post: ['post_caption', 'expected_snapshot'],
  update_reading_recap_post: ['post_caption'],
};
export const MEDIA_BUCKETS = ['post-media', 'avatars', 'club-covers'];
export function publicationFields(path, body) {
  const parts = path.split('/').filter(Boolean);
  const fields = parts[0] === 'rpc' ? UGC_RPC_FIELDS[parts[1]] : UGC_TABLE_FIELDS[parts[0]];
  if (!fields || parts.length !== (parts[0] === 'rpc' ? 2 : 1)) return null;
  const rows = Array.isArray(body) ? body : [body];
  if (rows.length > 20 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('Invalid publication.');
  return rows.map(row => Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => {
    let value = row[field];
    // Nested RPC inputs: screen visible user fields, not catalog data or private notes.
    if (field === 'discussion_input') value = Object.fromEntries(UGC_TABLE_FIELDS.club_discussions.filter(k => Object.hasOwn(value ?? {}, k)).map(k => [k, value[k]]));
    if (field === 'event_input') value = Object.fromEntries(UGC_TABLE_FIELDS.club_events.filter(k => Object.hasOwn(value ?? {}, k)).map(k => [k, value[k]]));
    if (field === 'read_input') value = Object.fromEntries(UGC_TABLE_FIELDS.club_reads.filter(k => Object.hasOwn(value ?? {}, k)).map(k => [k, value[k]]));
    return [field, value];
  })));
}
export function screeningText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(screeningText).join('\n');
  if (value && typeof value === 'object') return Object.entries(value).filter(([key]) => !['post_image_url', 'avatar_url', 'cover_url', 'coverUrl', 'book_cover_url', 'private_note', 'private_note_body', 'password', 'email'].includes(key)).map(([key, v]) => `${key}: ${screeningText(v)}`).join('\n');
  return '';
}
