import { Keyboard } from 'react-native';

/** Let the native keyboard finish resizing the window before opening a sheet. */
export async function dismissKeyboardBeforeWarning(): Promise<void> {
  if (!Keyboard.isVisible()) return;
  await new Promise<void>(resolve => {
    const finish = () => {
      subscription.remove();
      clearTimeout(fallback);
      resolve();
    };
    const subscription = Keyboard.addListener('keyboardDidHide', finish);
    // Some Android window modes do not deliver keyboard events.
    const fallback = setTimeout(finish, 500);
    Keyboard.dismiss();
  });
}
