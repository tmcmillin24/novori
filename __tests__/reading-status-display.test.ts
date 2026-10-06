import { getDisplayedReadingStatus } from '../src/lib/reading-status-display';

test.each(['want_to_read', 'reading', 'read', 'dnf'] as const)('successful %s selection survives stale and empty background reads', status => {
 const saved = { bookId: 'novel', status };
 expect(getDisplayedReadingStatus('novel', saved, null)).toBe(status);
 expect(getDisplayedReadingStatus('novel', saved, 'want_to_read')).toBe(status);
});
test('opening another book does not inherit the previous selection', () => {
 expect(getDisplayedReadingStatus('next', { bookId: 'novel', status: 'read' }, null)).toBeNull();
});
test('removing a book allows selecting its status again', () => {
 expect(getDisplayedReadingStatus('novel', null, null)).toBeNull();
});

test('missing route identity has no confirmed status', () => expect(getDisplayedReadingStatus(undefined, null, null)).toBeNull());
