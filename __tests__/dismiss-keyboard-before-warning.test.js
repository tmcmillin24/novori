import { Keyboard } from 'react-native';
import { dismissKeyboardBeforeWarning } from '../src/lib/dismiss-keyboard-before-warning';
jest.mock('react-native', () => ({ Keyboard: { isVisible: jest.fn(), addListener: jest.fn(), dismiss: jest.fn() } }));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => jest.useRealTimers());
test('waits for keyboard dismissal before presenting a warning', async () => {
  Keyboard.isVisible.mockReturnValue(true);
  let hide;
  const remove = jest.fn();
  Keyboard.addListener.mockImplementation((event, callback) => { expect(event).toBe('keyboardDidHide'); hide = callback; return { remove }; });
  let ready = false;
  const pending = dismissKeyboardBeforeWarning().then(() => { ready = true; });
  await Promise.resolve(); expect(ready).toBe(false);
  expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  hide(); await pending; expect(ready).toBe(true); expect(remove).toHaveBeenCalledTimes(1);
});
test('does not delay when the keyboard is already closed', async () => {
  Keyboard.isVisible.mockReturnValue(false);
  await dismissKeyboardBeforeWarning();
  expect(Keyboard.addListener).not.toHaveBeenCalled();
});
test('finishes when the platform does not emit keyboard events', async () => {
  Keyboard.isVisible.mockReturnValue(true);
  const remove = jest.fn(); Keyboard.addListener.mockReturnValue({ remove });
  const pending = dismissKeyboardBeforeWarning();
  jest.advanceTimersByTime(500); await pending; expect(remove).toHaveBeenCalledTimes(1);
});
