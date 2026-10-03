import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';

type Props = {
  visible: boolean;
  title: string;
  periodLabel: string;
  onEdit: () => void;
  onRemove: () => void;
  onDismiss: () => void;
};

export default function ReadingGoalActionsSheet({ visible, title, periodLabel, onEdit, onRemove, onDismiss }: Props) {
  const { colors } = useNovoriTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(12)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const closing = useRef(false);
  const pendingAction = useRef<(() => void) | undefined>(undefined);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Match Novori's existing fade, slide, and drag dismissal behavior.
  function animateIn() {
    closing.current = false;
    pendingAction.current = undefined;
    translateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();
    translateY.setValue(12);
    sheetOpacity.setValue(0);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 135, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sheetOpacity, { toValue: 1, duration: 105, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 125, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }

  function finishClose(finished: boolean) {
    closing.current = false;
    if (!finished) return;
    translateY.setValue(12);
    sheetOpacity.setValue(0);
    backdropOpacity.setValue(0);
    const action = pendingAction.current;
    pendingAction.current = undefined;
    onDismissRef.current();
    action?.();
  }

  function closeSmoothly(action?: () => void) {
    if (closing.current) return;
    closing.current = true;
    pendingAction.current = action;
    Animated.parallel([
      Animated.timing(translateY, { toValue: 12, duration: 115, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sheetOpacity, { toValue: 0, duration: 100, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 120, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => finishClose(finished));
  }

  function dismissByGesture() {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(translateY, { toValue: Math.max(sheetHeight.current + 32, 420), duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => finishClose(finished));
  }

  function restorePosition() {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 24, stiffness: 220, mass: 0.9, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !closing.current && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => {
      translateY.setValue(Math.max(0, gesture.dy));
      backdropOpacity.setValue(Math.max(0.18, 1 - Math.max(0, gesture.dy) / 520));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 88 || gesture.vy > 0.72) dismissByGesture();
      else restorePosition();
    },
    onPanResponderTerminate: restorePosition,
  }), [translateY, sheetOpacity, backdropOpacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onShow={animateIn} onRequestClose={() => closeSmoothly()}>
      <Pressable style={styles.backdrop} onPress={() => closeSmoothly()}>
        <Animated.View pointerEvents="none" style={[styles.backdropVisual, { opacity: backdropOpacity }]} />
        <Animated.View {...panResponder.panHandlers} accessibilityViewIsModal
          onLayout={(event) => { sheetHeight.current = event.nativeEvent.layout.height; }}
          style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 12), opacity: sheetOpacity, transform: [{ translateY }] }]}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.period}>{periodLabel}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} onPress={() => closeSmoothly(onEdit)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <View style={styles.actionIcon}><Ionicons name="create-outline" size={20} color={colors.gold} /></View>
              <Text style={styles.actionText}>Edit goal</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedText} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} onPress={() => closeSmoothly(onRemove)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <View style={styles.actionIcon}><Ionicons name="trash-outline" size={19} color={colors.danger} /></View>
              <Text style={[styles.actionText, { color: colors.danger }]}>Remove goal</Text>
            </Pressable>
            <Text style={styles.note}>Removing a goal keeps your reading history.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel goal options" onPress={() => closeSmoothly()}
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end' },
    backdropVisual: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.48)' },
    sheet: { width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, overflow: 'hidden' },
    handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 13 },
    title: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 21, textAlign: 'center' },
    period: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 14 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12,
      backgroundColor: colors.elevated, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    actionIcon: { width: 28, alignItems: 'center' }, actionText: { flex: 1, color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    note: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 4 },
    cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    cancelText: { color: colors.secondaryText, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    pressed: { opacity: 0.76 },
  });
}
