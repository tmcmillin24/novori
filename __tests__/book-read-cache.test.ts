import { test, expect, jest, afterEach } from '@jest/globals';
import { createBookReadCache } from '../src/lib/book-read-cache';

afterEach(() => { jest.useRealTimers(); });

test('concurrent readers share a request but cannot mutate each other or cached data', async () => {
  const read = createBookReadCache<{ books: { id: string }[] }>();
  const load = jest.fn(async () => ({ books: [{ id: 'original' }] }));
  const [a, b] = await Promise.all([read('query', load), read('query', load)]);
  a.books[0].id = 'changed';
  expect(b.books[0].id).toBe('original');
  expect((await read('query', load)).books[0].id).toBe('original');
  expect(load).toHaveBeenCalledTimes(1);
});

test('expiration and capacity bound local book metadata', async () => {
  jest.useFakeTimers();
  const read = createBookReadCache<number>(1000, 2);
  const load = jest.fn(async () => 1);
  await read('a', load); await read('b', load); await read('c', load);
  await read('a', load);
  expect(load).toHaveBeenCalledTimes(4);
  jest.advanceTimersByTime(1001);
  await read('a', load);
  expect(load).toHaveBeenCalledTimes(5);
});

test('failed and unsuccessful identity reads are retried instead of cached', async () => {
  const read = createBookReadCache<{ ok: boolean }>();
  const failed = jest.fn(async () => { throw new Error('offline'); });
  await expect(read('query', failed)).rejects.toThrow('offline');
  await expect(read('query', failed)).rejects.toThrow('offline');
  expect(failed).toHaveBeenCalledTimes(2);
  const missing = jest.fn(async () => ({ ok: false }));
  await read('query', missing, value => value.ok);
  await read('query', missing, value => value.ok);
  expect(missing).toHaveBeenCalledTimes(2);
});

test('concurrent and late subscribers share isolated previews and one final cached load', async () => {
  const read = createBookReadCache<{ id: string }[]>();
  let publish!: (rows: {id:string}[]) => void;
  let finish!: (rows: {id:string}[]) => void;
  const load = jest.fn((emit: typeof publish) => { publish=emit; return new Promise<{id:string}[]>(resolve=>{finish=resolve;}); });
  const first=jest.fn((rows:{id:string}[])=>{rows[0].id='mutated';});
  const a=read('same',load,()=>true,first);
  await Promise.resolve();
  publish([{id:'preview'}]);
  const second=jest.fn();
  const b=read('same',load,()=>true,second);
  expect(second).toHaveBeenCalledWith([{id:'preview'}]);
  finish([{id:'final'}]);
  expect(await Promise.all([a,b])).toEqual([[{id:'final'}],[{id:'final'}]]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(await read('same',load)).toEqual([{id:'final'}]);
});
test('preview is not persisted as complete when the final lookup fails',async()=>{
 const read=createBookReadCache<string[]>();
 const load=jest.fn(async(publish:(rows:string[])=>void)=>{publish(['preview']);throw new Error('failed');});
 const progress=jest.fn();
 await expect(read('key',load,()=>true,progress)).rejects.toThrow('failed');
 await expect(read('key',load)).rejects.toThrow('failed');
 expect(load).toHaveBeenCalledTimes(2);
 expect(progress).toHaveBeenCalledTimes(1);
});
