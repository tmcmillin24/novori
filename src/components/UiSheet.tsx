import {scheduleOnRN,scheduleOnUI} from 'react-native-worklets';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Modal, type ModalProps, type ViewProps, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
const opening = Easing.bezier(0.32, 0, 0.18, 1);
const closingCurve = Easing.bezier(0.32, 0, 0.67, 1);
type Options = {
    visible: boolean;
    busy?: boolean;
    embedded?: boolean;
    onDismiss: () => void;
};
/** Shared window-safe lifecycle for action, filter, and confirmation sheets. */
export function useUiSheetMotion({ visible, busy = false, embedded = false, onDismiss }: Options) {
    const y = useSharedValue(0), opacity = useSharedValue(0), backdrop = useSharedValue(0), height = useSharedValue(0);
    const moving = useSharedValue(false), blocked = useSharedValue(busy), dragging = useSharedValue(false), generation = useSharedValue(0);
    const closing = useRef(false), shown = useRef(false), started = useRef(false), measured = useRef(0), after = useRef<(() => void) | undefined>(undefined);
    const alive = useRef(true);
    const callbacks = useRef({ visible, busy, onDismiss });
    callbacks.current = { visible, busy, onDismiss };
    const finish = useCallback((token: number) => {
        if (!alive.current || !callbacks.current.visible || generation.value !== token) return;
        closing.current = false;
        const action = after.current;
        after.current = undefined;
        callbacks.current.onDismiss();
        action?.();
    }, [generation]);
    const markClosing = useCallback((token: number) => { if (alive.current && callbacks.current.visible && generation.value === token) closing.current = true; }, [generation]);
    const stop = useCallback(() => {
        generation.value += 1;
        cancelAnimation(y);
        cancelAnimation(opacity);
        cancelAnimation(backdrop);
        moving.value = false;
        dragging.value = false;
    }, [generation, y, opacity, backdrop, moving, dragging]);
    useEffect(() => { blocked.value = busy; }, [busy, blocked]);
    useEffect(() => {
        if (!visible) {
            stop();
            shown.current = false;
            started.current = false;
            closing.current = false;
            after.current = undefined;
            opacity.value = 0;
        }
    }, [visible, stop, opacity]);
    useEffect(() => { alive.current = true; return () => { alive.current = false; stop(); }; }, [stop]);
    const open = useCallback(() => {
        if (started.current || !shown.current || !callbacks.current.visible || measured.current <= 0)
            return;
        started.current = true;
        closing.current = false;
        after.current = undefined;
        const sheetHeight = measured.current;
        scheduleOnUI(() => {
            'worklet';
            const token = ++generation.value;
            cancelAnimation(y);
            height.value = sheetHeight;
            y.value = sheetHeight + 1;
            opacity.value = 1;
            backdrop.value = 0;
            moving.value = true;
            requestAnimationFrame(() => {
                if (token !== generation.value)
                    return;
                backdrop.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
                y.value = withTiming(0, { duration: 245, easing: opening }, finished => { if (finished && token === generation.value)
                    moving.value = false; });
            });
        });
    }, [generation, y, height, opacity, backdrop, moving]);
    const onShow = useCallback(() => { shown.current = true; open(); }, [open]);
    const onLayout = useCallback((event: LayoutChangeEvent) => {
        measured.current = event.nativeEvent.layout.height;
        height.value = measured.current;
        if (embedded)
            shown.current = true;
        open();
    }, [height, embedded, open]);
    const startClose = useCallback((action?: unknown, completedAction = false) => {
        if ((callbacks.current.busy && !completedAction) || closing.current)
            return;
        closing.current = true;
        after.current = typeof action === 'function' ? action as () => void : undefined;
        scheduleOnUI(() => {
            'worklet';
            const token = ++generation.value;
            moving.value = true;
            dragging.value = false;
            backdrop.value = withTiming(0, { duration: 180 });
            y.value = withTiming(height.value + 24, { duration: 210, easing: closingCurve }, finished => {
                if (finished && token === generation.value) {
                    opacity.value = 0;
                    moving.value = false;
                    scheduleOnRN(finish, token);
                }
            });
        });
    }, [generation, moving, dragging, backdrop, y, height, opacity, finish]);
    const close = useCallback((action?: unknown) => startClose(action), [startClose]);
    const closeAfterAction = useCallback(() => startClose(undefined, true), [startClose]);
    const closeAfterActionWithCallback = useCallback((action?: unknown) => startClose(action, true), [startClose]);
    const gesture = useMemo(() => Gesture.Pan().activeOffsetY(6).failOffsetX([-20, 20])
        .onStart(() => {
        dragging.value = false;
        if (blocked.value || moving.value)
            return;
        dragging.value = true;
        cancelAnimation(y);
    })
        .onUpdate(event => {
        if (!dragging.value || blocked.value || moving.value)
            return;
        y.value = Math.max(0, event.translationY);
        backdrop.value = Math.max(0.18, 1 - y.value / 520);
    })
        .onEnd(event => {
        if (!dragging.value)
            return;
        dragging.value = false;
        if (!blocked.value && (event.translationY > 88 || event.velocityY > 720)) {
            const token = ++generation.value;
            moving.value = true;
            scheduleOnRN(markClosing, token);
            backdrop.value = withTiming(0, { duration: 180 });
            y.value = withTiming(height.value + 24, { duration: 210, easing: closingCurve }, finished => {
                if (finished && token === generation.value) {
                    opacity.value = 0;
                    moving.value = false;
                    scheduleOnRN(finish, token);
                }
            });
        }
        else {
            moving.value = true;
            backdrop.value = withTiming(1, { duration: 120 });
            y.value = withSpring(0, { damping: 24, stiffness: 220, mass: 0.9 }, finished => { if (finished)
                moving.value = false; });
        }
    })
        .onFinalize((_event, success) => {
        if (success || !dragging.value)
            return;
        dragging.value = false;
        moving.value = true;
        backdrop.value = withTiming(1, { duration: 120 });
        y.value = withSpring(0, { damping: 24, stiffness: 220, mass: 0.9 }, finished => { if (finished)
            moving.value = false; });
    }), [dragging, blocked, moving, y, backdrop, generation, height, opacity, markClosing, finish]);
    const sheetStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: y.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
    return { closing, close, closeAfterAction, closeAfterActionWithCallback, onShow, onLayout, gesture, sheetStyle, backdropStyle };
}
type Motion = ReturnType<typeof useUiSheetMotion>;
export function UiSheetModal({ motion, children, ...props }: ModalProps & {
    motion: Motion;
    children: ReactNode;
}) {
    return <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} {...props} animationType="none" onShow={motion.onShow}><GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView></Modal>;
}
export function UiSheetSurface({ motion, style, ...props }: ViewProps & {
    motion: Motion;
}) {
    return <GestureDetector gesture={motion.gesture}><Animated.View {...props} collapsable={false} onLayout={motion.onLayout} style={[style, { maxWidth: 720, alignSelf: 'center' }, motion.sheetStyle]}/></GestureDetector>;
}
export function UiSheetBackdrop({ motion, style, ...props }: ViewProps & {
    motion: Motion;
}) {
    return <Animated.View {...props} pointerEvents="none" style={[style, motion.backdropStyle]}/>;
}
