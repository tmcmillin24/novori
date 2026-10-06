import { moderationMediaUrl } from '../lib/moderation-media-url';
import UiAnimated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUiCropGesture } from '../lib/use-ui-crop-gesture';
import { Ionicons } from '@expo/vector-icons';
import { cropSquareImage } from '../lib/crop-square-image';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
const MAX_ZOOM = 4;
export type PostCropAsset = {
    uri: string;
    width: number;
    height: number;
};
type Props = {
    visible: boolean;
    asset: PostCropAsset | null;
    colors: NovoriColors;
    title?: string;
    onCancel: () => void;
    onUse: (uri: string) => void;
};
type TouchPoint = {
    x: number;
    y: number;
};
function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
function distanceBetweenTouches(first: {
    pageX: number;
    pageY: number;
}, second: {
    pageX: number;
    pageY: number;
}) {
    return Math.hypot(second.pageX -
        first.pageX, second.pageY -
        first.pageY);
}
export default function PostPhotoCropper({ visible, asset, colors, title = 'Position Photo', onCancel, onUse, }: Props) {
    const insets = useSafeAreaInsets();
    const { width, height, } = useWindowDimensions();
    const cropSize = Math.min(width - 28, height * 0.58, 430);
    const styles = createStyles(colors, cropSize);
    const [working, setWorking,] = useState(false);
    const [zoom, setZoom,] = useState(1);
    const [translateX, setTranslateX,] = useState(0);
    const [translateY, setTranslateY,] = useState(0);
    const zoomRef = useRef(1);
    const translateXRef = useRef(0);
    const translateYRef = useRef(0);
    const lastTouchRef = useRef<TouchPoint | null>(null);
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartZoomRef = useRef(1);
    const cropGeometry = useMemo(() => {
        if (!asset) {
            return null;
        }
        const baseScale = Math.max(cropSize /
            asset.width, cropSize /
            asset.height);
        return {
            baseScale,
            baseWidth: asset.width *
                baseScale,
            baseHeight: asset.height *
                baseScale,
        };
    }, [
        asset,
        cropSize,
    ]);
    function clampTranslation(x: number, y: number, nextZoom = zoomRef.current) {
        if (!cropGeometry) {
            return {
                x: 0,
                y: 0,
            };
        }
        const renderedWidth = cropGeometry.baseWidth *
            nextZoom;
        const renderedHeight = cropGeometry.baseHeight *
            nextZoom;
        const maxX = Math.max(0, (renderedWidth -
            cropSize) / 2);
        const maxY = Math.max(0, (renderedHeight -
            cropSize) / 2);
        return {
            x: clamp(x, -maxX, maxX),
            y: clamp(y, -maxY, maxY),
        };
    }
    function applyTranslation(x: number, y: number) {
        const next = clampTranslation(x, y);
        translateXRef.current =
            next.x;
        translateYRef.current =
            next.y;
        setTranslateX(next.x);
        setTranslateY(next.y);
    }
    function applyZoom(nextZoom: number) {
        const safeZoom = clamp(nextZoom, 1, MAX_ZOOM);
        zoomRef.current =
            safeZoom;
        setZoom(safeZoom);
        const nextTranslation = clampTranslation(translateXRef.current, translateYRef.current, safeZoom);
        translateXRef.current =
            nextTranslation.x;
        translateYRef.current =
            nextTranslation.y;
        setTranslateX(nextTranslation.x);
        setTranslateY(nextTranslation.y);
    }
    function resetCrop() {
        zoomRef.current =
            1;
        translateXRef.current =
            0;
        translateYRef.current =
            0;
        setZoom(1);
        setTranslateX(0);
        setTranslateY(0);
        lastTouchRef.current =
            null;
        pinchStartDistanceRef.current =
            null;
    }
    const cropMotion = useUiCropGesture({ geometry: cropGeometry, size: cropSize, maxZoom: MAX_ZOOM, x: translateX, y: translateY, zoom, busy: working, onCommit: (x, y, z) => { translateXRef.current = x; translateYRef.current = y; zoomRef.current = z; setTranslateX(x); setTranslateY(y); setZoom(z); } });
    async function usePhoto() {
        const pose = cropMotion.read();
        translateXRef.current = pose.x;
        translateYRef.current = pose.y;
        zoomRef.current = pose.zoom;
        if (!asset ||
            !cropGeometry ||
            working) {
            return;
        }
        try {
            setWorking(true);
            const totalScale = cropGeometry.baseScale *
                zoomRef.current;
            const cropSizeInSource = cropSize /
                totalScale;
            const originX = clamp(asset.width / 2 -
                translateXRef.current /
                    totalScale -
                cropSizeInSource /
                    2, 0, asset.width -
                cropSizeInSource);
            const originY = clamp(asset.height / 2 -
                translateYRef.current /
                    totalScale -
                cropSizeInSource /
                    2, 0, asset.height -
                cropSizeInSource);
            const cropped = await cropSquareImage(asset.uri, {
                originX,
                originY,
                width: cropSizeInSource,
                height: cropSizeInSource,
            });
            onUse(cropped.uri);
            resetCrop();
        }
        finally {
            setWorking(false);
        }
    }
    function close() {
        if (working) {
            return;
        }
        resetCrop();
        onCancel();
    }
    return (<Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}><GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.screen}>
        <View style={[
            styles.header,
            {
                paddingTop: Math.max(insets.top, 12),
                height: 58 +
                    Math.max(insets.top, 12),
            },
        ]}>
          <Pressable disabled={working} onPress={close} style={styles.headerButton}>
            <Text style={styles.cancelText}>
              Cancel
            </Text>
          </Pressable>

          <Text style={styles.title}>
            {title}
          </Text>

          <Pressable disabled={working} onPress={usePhoto} style={[
            styles.headerButton,
            styles.useButton,
        ]}>
            {working ? (<ActivityIndicator size="small" color={colors.gold}/>) : (<Text style={styles.useText}>
                Use
              </Text>)}
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.help}>
            Drag to reposition • Pinch to zoom
          </Text>

          <GestureDetector gesture={cropMotion.gesture}><View style={styles.cropFrame} collapsable={false}>
            {asset &&
            cropGeometry ? (<UiAnimated.Image source={{
                uri: moderationMediaUrl(asset.uri),
            }} style={[
                styles.image,
                {
                    width: cropGeometry.baseWidth,
                    height: cropGeometry.baseHeight
                },
                cropMotion.style
            ]}/>) : null}
          </View></GestureDetector>

          <Pressable disabled={working} onPress={resetCrop} style={styles.resetButton}>
            <Ionicons name="refresh-outline" size={16} color={colors.secondaryText}/>

            <Text style={styles.resetText}>
              Reset position
            </Text>
          </Pressable>
        </View>
      </View>
    </GestureHandlerRootView></Modal>);
}
function createStyles(colors: NovoriColors, cropSize: number) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: '#11110F',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingHorizontal: 10,
        },
        headerButton: {
            width: 70,
            height: 44,
            justifyContent: 'center',
        },
        useButton: {
            alignItems: 'flex-end',
        },
        cancelText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        useText: {
            color: colors.gold,
            fontFamily: 'Inter_700Bold',
            fontSize: 14,
        },
        title: {
            flex: 1,
            color: colors.text,
            textAlign: 'center',
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 18,
        },
        body: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 14,
            paddingBottom: 24,
        },
        help: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            marginBottom: 14,
        },
        cropFrame: {
            width: cropSize,
            height: cropSize,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: colors.elevated,
            borderWidth: 2,
            borderColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        image: {
            position: 'absolute',
        },
        resetButton: {
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: 16,
            marginTop: 20,
        },
        resetText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
    });
}
