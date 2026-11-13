import {createNotificationCountRefresh} from '../src/lib/notification-count-refresh';
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
beforeEach(()=>jest.useFakeTimers());afterEach(()=>jest.useRealTimers());
it('coalesces realtime bursts and preserves the last count through temporary failure',async()=>{
 const read=jest.fn().mockRejectedValueOnce(Error('fetch failed')).mockResolvedValue(5),apply=jest.fn(),report=jest.fn();
 const c=createNotificationCountRefresh({read,apply,report,retryable:()=>true});c.request();c.request();c.request();
 jest.advanceTimersByTime(120);await flush();expect(read).toHaveBeenCalledTimes(1);expect(apply).not.toHaveBeenCalled();expect(report).not.toHaveBeenCalled();
 jest.advanceTimersByTime(1000);await flush();expect(read).toHaveBeenCalledTimes(2);expect(apply).toHaveBeenCalledWith(5);c.dispose();
});
it('does not read in background and retries on foreground',async()=>{
 const read=jest.fn().mockResolvedValue(3),apply=jest.fn();const c=createNotificationCountRefresh({read,apply,report:jest.fn(),retryable:()=>true,foreground:false});
 c.request();jest.advanceTimersByTime(10000);expect(read).not.toHaveBeenCalled();c.setForeground(true);jest.advanceTimersByTime(120);await flush();expect(apply).toHaveBeenCalledWith(3);c.dispose();
});
it('aborts background work and does not publish a stale result',async()=>{
 let done!:(n:number)=>void;let signal!:AbortSignal;const read=jest.fn((s:AbortSignal)=>{signal=s;return new Promise<number>(resolve=>done=resolve);}),apply=jest.fn();
 const c=createNotificationCountRefresh({read,apply,report:jest.fn(),retryable:()=>true});c.request();jest.advanceTimersByTime(120);c.setForeground(false);expect(signal.aborted).toBe(true);done(9);await flush();expect(apply).not.toHaveBeenCalled();c.dispose();
});
it('stops retries after three and does not spin indefinitely',async()=>{
 const read=jest.fn().mockRejectedValue(Error('offline')),report=jest.fn();const c=createNotificationCountRefresh({read,apply:jest.fn(),report,retryable:()=>true});c.request();
 for(const delay of [120,1000,3000,10000]){jest.advanceTimersByTime(delay);await flush();}expect(read).toHaveBeenCalledTimes(4);expect(report).toHaveBeenCalledTimes(1);
 jest.advanceTimersByTime(60000);expect(read).toHaveBeenCalledTimes(4);c.dispose();
});
it('disposal prevents updates and further realtime scheduling',async()=>{
 let done!:(n:number)=>void;const apply=jest.fn(),read=jest.fn(()=>new Promise<number>(resolve=>done=resolve));const c=createNotificationCountRefresh({read,apply,report:jest.fn(),retryable:()=>true});
 c.request();jest.advanceTimersByTime(120);c.dispose();done(7);await flush();c.request();jest.advanceTimersByTime(10000);expect(apply).not.toHaveBeenCalled();expect(read).toHaveBeenCalledTimes(1);
});
