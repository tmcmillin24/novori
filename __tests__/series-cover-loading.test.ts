import { loadMissingSeriesCovers } from '../src/lib/series-cover-loading';
import { test, expect, jest } from '@jest/globals';

const row = { id: 1, title: 'Iron Flame', authors: ['Rebecca Yarros'] };
const result = { id: 'english', volumeInfo: { title: 'Iron Flame', authors: ['Rebecca Yarros'], language: 'en', imageLinks: {thumbnail:'https://covers/good.jpg'} } };

test('loads missing series covers without opening books, skips cached and unannounced rows', async () => {
 const search = jest.fn<(title: string) => Promise<any[]>>().mockResolvedValue([
  { ...result, id: 'foreign', volumeInfo: { ...result.volumeInfo, language: 'es' } },
  { ...result, id: 'wrong-author', volumeInfo: { ...result.volumeInfo, authors: ['Someone Else'] } },
  result,
 ]);
 const publish = jest.fn();
 await loadMissingSeriesCovers([row, { ...row, id: 2, coverBookId: 'cached', coverUrl: 'https://covers/cached.jpg' }, { ...row, id: 3, title: 'Unannounced' }], search, publish, () => true);
 expect(search).toHaveBeenCalledTimes(1);
 expect(publish).toHaveBeenCalledWith(row, 'english');
});

test('cancelled series cannot update the next book or start another lookup', async () => {
 let active = true;
 const search = jest.fn<(title: string) => Promise<any[]>>().mockImplementation(async () => { active = false; return [result]; });
 const publish = jest.fn();
 await loadMissingSeriesCovers([row, { ...row, id: 2 }], search, publish, () => active);
 expect(search).toHaveBeenCalledTimes(1);
 expect(publish).not.toHaveBeenCalled();
});

test('an optional cover failure does not abort the remaining series', async () => {
 const search = jest.fn<(title: string) => Promise<any[]>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([result]);
 const publish = jest.fn();
 await loadMissingSeriesCovers([row, { ...row, id: 2 }], search, publish, () => true);
 expect(publish).toHaveBeenCalledTimes(1);
 expect(publish).toHaveBeenCalledWith({ ...row, id: 2 }, 'english');
});

 test('an existing ID without artwork is repaired and a coverless first match is skipped', async () => {
 const missing = {...row, coverBookId:'old'};
 const search = jest.fn<(title:string)=>Promise<any[]>>().mockResolvedValue([
 {...result,id:'empty',volumeInfo:{...result.volumeInfo,imageLinks:{}}},result]);
 const publish = jest.fn();
 await loadMissingSeriesCovers([missing],search,publish,()=>true);
 expect(publish).toHaveBeenCalledWith(missing,'english');
 });
