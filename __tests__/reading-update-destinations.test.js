const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function harness({ missing = false, member = true, publishError = null } = {}) {
  const calls = [], updates = [], checkins = [], mutations = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'reader' } } }) },
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (missing && name === 'publish_reading_update_to_destination') return { error: { code: 'PGRST202', message: 'Missing RPC' } };
      return publishError ? { error: publishError } : { data: 'post-1', error: null };
    },
    from(table) {
      const query = {
        select: () => query, eq: () => query,
        update: (value) => { updates.push({ table, value }); return query; },
        maybeSingle: async () => ({ data: member ? { club_id: 'club-1' } : null }),
        single: async () => ({ data: { id: 'post-1' } }),
      };
      return query;
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/reading-updates.ts'), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, console, Date, require: (name) => name.includes('supabase') ? { supabase }
      : name.includes('checkins') ? { ensureDailyReadingCheckin: async (...args) => checkins.push(args) }
      : { markPostMutation: () => mutations.push(true) },
  });
  return { api: exports, calls, updates, checkins, mutations };
}

test('club publication passes progress, audio, private thought and source note through one atomic publisher', async () => {
  const h = harness();
  await h.api.publishReadingUpdate({ googleBookId: 'book-1', clubId: 'club-1', progress: '50%', chapter: '4', audioPosition: '1:02:03', thought: 'A thought', sourceNoteId: 'note-1' });
  expect(h.calls).toEqual([{ name: 'publish_reading_update_to_destination', args: {
    target_google_book_id: 'book-1', target_club_id: 'club-1', post_body: '50% · Chapter 4 · Audio 1:02:03\n\nA thought',
    checkpoint_page_number: null, checkpoint_progress_percent: 50, checkpoint_chapter: '4',
    checkpoint_audio_position_seconds: 3723, private_note_body: 'A thought', source_note_id: 'note-1',
  } }]);
  expect(h.checkins).toEqual([[['book-1'], 'reading_update']]);
  expect(h.updates).toHaveLength(0);
});

test('feed publishing remains compatible before the destination SQL is installed', async () => {
  const h = harness({ missing: true });
  await h.api.publishReadingUpdate({ googleBookId: 'book-1', progress: '12' });
  expect(h.calls.map((call) => call.name)).toEqual(['publish_reading_update_to_destination', 'publish_reading_update']);
  expect(h.calls[1].args).not.toHaveProperty('target_club_id');
});

test('a club draft never falls back to feed publishing if the new publisher is missing', async () => {
  const h = harness({ missing: true });
  await expect(h.api.publishReadingUpdate({ googleBookId: 'book-1', clubId: 'club-1', progress: '12' })).rejects.toThrow('SQL update');
  expect(h.calls).toHaveLength(1);
  expect(h.checkins).toHaveLength(0);
});

test('publisher errors do not trigger a second publication or record a check-in', async () => {
  const h = harness({ publishError: { code: '42501', message: 'Not a club member' } });
  await expect(h.api.publishReadingUpdate({ googleBookId: 'book-1', clubId: 'club-1', thought: 'Hello' })).rejects.toEqual({ code: '42501', message: 'Not a club member' });
  expect(h.calls).toHaveLength(1);
  expect(h.checkins).toHaveLength(0);
});

test('editing can change destination without overwriting the existing book metadata', async () => {
  const h = harness();
  await h.api.updateReadingUpdate('post-1', { googleBookId: 'book-1', clubId: 'club-1', progress: '20' });
  expect(h.updates[0].value).toMatchObject({ body: 'Page 20', club_id: 'club-1' });
  expect(h.updates[0].value).not.toHaveProperty('book_cover_url');
  expect(h.updates[0].value).not.toHaveProperty('book_authors');
  expect(h.mutations).toHaveLength(1);
});

test('editing into a club requires membership, and callers without a destination preserve it', async () => {
  const denied = harness({ member: false });
  await expect(denied.api.updateReadingUpdate('post-1', { googleBookId: 'book-1', clubId: 'club-1', thought: 'Hello' })).rejects.toThrow('Join this club');
  expect(denied.updates).toHaveLength(0);
  const h = harness();
  await h.api.updateReadingUpdate('post-1', { googleBookId: 'book-1', thought: 'Edited private-note share' });
  expect(h.updates[0].value).not.toHaveProperty('club_id');
});
