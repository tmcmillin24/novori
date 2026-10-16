import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// iOS must release the source modal before another native modal is presented.
export function useSheetAction(visible: boolean) {
  const pending = useRef<(() => void) | undefined>(undefined);
  const afterDismiss = () => {
    const action = pending.current;
    pending.current = undefined;
    action?.();
  };
  useEffect(() => {
    if (!visible && Platform.OS !== 'ios') afterDismiss();
  }, [visible]);
  return { queue: (action: () => void) => { pending.current = action; }, afterDismiss };
}
