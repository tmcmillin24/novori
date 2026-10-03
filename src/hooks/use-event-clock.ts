import { useEffect,useState } from 'react';
import { AppState } from 'react-native';
export default function useEventClock(deadline?: number) {
  const [now,setNow] = useState(Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = setInterval(update,30000);
    const timer = deadline && deadline > Date.now() ? setTimeout(update,Math.min(deadline-Date.now()+20,2147483647)) : undefined;
    const listener = AppState.addEventListener('change',state => { if (state === 'active') update(); });
    return () => { clearInterval(interval);if (timer) clearTimeout(timer);listener.remove(); };
  },[deadline]);
  return now;
}
