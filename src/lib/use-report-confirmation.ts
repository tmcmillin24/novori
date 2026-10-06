import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** Present the shared success sheet only after the report modal releases iOS. */
export function useReportConfirmation(sourceVisible: boolean) {
  const [visible, setVisible] = useState(false);
  const pending = useRef(false);
  function afterDismiss() {
    if (!pending.current) return;
    pending.current = false;
    setVisible(true);
  }
  useEffect(() => {
    if (!sourceVisible && Platform.OS !== 'ios') afterDismiss();
  }, [sourceVisible]);
  return {
    visible,
    queue: () => { pending.current = true; },
    present: () => setVisible(true),
    afterDismiss,
    dismiss: () => setVisible(false),
  };
}
