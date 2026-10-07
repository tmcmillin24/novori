# UI animation and dependency audit — 2026-10-04

## Result

All custom sheet and swipe drag frames now use Reanimated shared values and Gesture Handler worklets. React receives final gestures or discrete business events rather than per-frame positions. The accepted Home comment entrance remains 245 ms with bezier `(0.32, 0, 0.18, 1)`, beginning fully below the window on the next UI frame. Conversation handoff coverage and back-to-sheet restoration remain intact.

## Coverage

- Shared `UiSheet` lifecycle replaces 39 duplicated action, confirmation, filter, report, and reading-detail sheet flows (17 reusable components, 13 inline flows, 9 reading-detail editors).
- Notification and cart swipe removal use UI-thread positions and preserve dismissal thresholds.
- Post, club, and profile photo pan/pinch gestures update shared values; React receives the final crop pose. Save reads the current UI pose. Bounds, 1024-pixel output, and JPEG quality 0.9 are preserved.
- Reading-goal progress width uses Reanimated and its system reduce-motion behavior.
- Book Stack row movement stays on the UI thread. JavaScript updates only when the discrete drop target/edge changes.
- Worklets scheduling uses `scheduleOnRN`/`scheduleOnUI`. Cropping uses the contextual ImageManipulator API, releasing native resources even when saving fails.
- The author screen uses `react-native-safe-area-context`; Book Stack actions use the supported `StyleSheet.absoluteFill` property.

Core Animated fades and orbit transforms still use the native driver. Native screen/modal transitions, keyboard-controller transforms, and native LayoutAnimation remain supported native animations. They do not require migration merely because they use a different API.

A source scan found no remaining `PanResponder`, `manipulateAsync`, `runOnJS`, `runOnUI`, or `useNativeDriver: false` paths.

## Dependencies

Installed the current Expo SDK 57 recommended patches for Expo, Expo UI, build properties, camera, constants, glass effect, image manipulator, image picker, linking, and router. Constants resolves to 57.0.20 within its existing compatible range.

`expo install --check`: dependencies up to date. `expo-doctor`: 21/21 checks passed. Reanimated 4.5.1, Worklets 0.10.1, Gesture Handler 2.32.0, React Native 0.86.3, and keyboard-controller 1.21.9 match the SDK's supported matrix.

An npm registry audit also lists newer independently released versions of several packages. SDK-owned native packages, React, and the test/type toolchain remain at SDK-compatible versions; the registry's newest version alone does not establish compatibility. Non-UI Supabase and Sharp updates were identified but left outside this UI migration.

## Validation

- 598 tests passed in 55 suites, with a clean Jest exit. Added gesture lifecycle, busy confirmation, cancellation, crop bounds, resource cleanup, and stack-target regression checks.
- Production Hermes bundles exported successfully for iOS and Android.
- No new TypeScript diagnostics compared with the pre-audit baseline; the obsolete absoluteFillObject error was resolved. Repository-wide type checking still has pre-existing application and Supabase/Deno configuration errors.
- Expo compatibility checks passed; git diff whitespace checks passed.

These checks validate behavior and compilation, not measured frame times on a physical iPhone. Physical testing is still needed after installing the rebuilt native app.

## Install and phone check

Pull `phase5-ask-readers`, run `npm ci`, and rebuild/reinstall the development client because native Expo packages changed. On the existing Mac/iPhone development setup, use `npx expo run:ios --device` (or the established native build process). A Metro reload alone cannot install native package patches. No database migration is required.

Test without screen recording: Feed comments open/drag/close; View conversation and Back; action/report/delete/filter sheets; reading-detail editors; cart/notification swipe removal; photo pan/pinch/save; and Book Stack dragging across several rows. Confirm busy operations reject dismissal, successful actions close once, failures preserve their draft, and Reduce Motion behaves appropriately.
