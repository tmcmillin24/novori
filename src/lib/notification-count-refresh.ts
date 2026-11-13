// Realtime bursts share one read. Background/disposed reads cannot overwrite UI.
export function createNotificationCountRefresh(options: {
  read: (signal: AbortSignal) => Promise<number>;
  apply: (count: number) => void;
  retryable: (error: unknown) => boolean;
  report: (error: unknown) => void;
  foreground?: boolean;
}) {
  let foreground = options.foreground ?? true, disposed = false, dirty = false, running = false, failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  function schedule(delay = 120) {
    if (disposed || !foreground || running || timer) return;
    timer = setTimeout(() => { timer = undefined; void run(); }, delay);
  }
  async function run() {
    if (disposed || !foreground || running || !dirty) return;
    dirty = false; running = true;
    const request = new AbortController(); controller = request;
    let retryDelay: number | undefined;
    try {
      const count = await options.read(request.signal);
      if (!disposed && foreground && !request.signal.aborted) { failures = 0; options.apply(count); }
    } catch (error) {
      if (!disposed && foreground && !request.signal.aborted) {
        failures++;
        if (options.retryable(error) && failures <= 3) { dirty = true; retryDelay = [1000, 3000, 10000][failures - 1]; }
        else { dirty = false; options.report(error); }
      }
    } finally {
      running = false;
      if (controller === request) controller = undefined;
      if (dirty) schedule(retryDelay);
    }
  }
  return {
    request() { if (disposed) return; dirty = true; failures = 0; schedule(); },
    setForeground(value: boolean) {
      if (disposed || foreground === value) return;
      foreground = value; dirty = true; failures = 0;
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (!foreground) controller?.abort(); else schedule();
    },
    dispose() { disposed = true; dirty = false; if (timer) clearTimeout(timer); controller?.abort(); },
  };
}
