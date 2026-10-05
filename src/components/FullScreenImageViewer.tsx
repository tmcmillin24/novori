import { moderationMediaUrl } from '../lib/moderation-media-url';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type ImageViewerShape =
  | 'natural'
  | 'circle'
  | 'rounded-square';

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  shape?: ImageViewerShape;
};

export default function FullScreenImageViewer({
  visible,
  uri,
  onClose,
  shape = 'natural',
}: Props) {
  const insets =
    useSafeAreaInsets();

  if (!uri) {
    return null;
  }

  return (
    <Modal
      visible={
        visible
      }
      transparent
      animationType="fade"
      onRequestClose={
        onClose
      }
      statusBarTranslucent
    >
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
          'right',
          'bottom',
          'left',
        ]}
      >
        <View
          style={[
            styles.header,
            {
              paddingTop:
                Math.max(
                  insets.top,
                  12
                ),
              paddingRight:
                Math.max(
                  insets.right,
                  12
                ),
            },
          ]}
        >
          <Pressable
            onPress={
              onClose
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            style={({ pressed }) => [
              styles.closeButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="close"
              size={27}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <Pressable
          onPress={
            onClose
          }
          accessibilityRole="button"
          accessibilityLabel="Close enlarged image"
          style={
            styles.imageArea
          }
        >
          <View
            style={[
              styles.imageFrame,
              shape ===
                'circle' &&
                styles.circleFrame,
              shape ===
                'rounded-square' &&
                styles.roundedSquareFrame,
              shape ===
                'natural' &&
                styles.naturalFrame,
            ]}
          >
            <Image
              source={{
                uri: moderationMediaUrl(uri),
              }}
              style={
                styles.image
              }
              resizeMode="contain"
            />
          </View>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.97)',
    },

    header: {
      minHeight: 76,
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'flex-end',
      paddingLeft: 12,
      paddingBottom: 8,
    },

    closeButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(34,34,34,0.9)',
    },

    imageArea: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 10,
      paddingBottom: 10,
    },

    imageFrame: {
      alignItems:
        'center',
      justifyContent:
        'center',
      overflow:
        'hidden',
    },

    circleFrame: {
      width: '82%',
      maxWidth: 420,
      aspectRatio: 1,
      borderRadius: 9999,
    },

    roundedSquareFrame: {
      width: '82%',
      maxWidth: 420,
      aspectRatio: 1,
      borderRadius: 28,
    },

    naturalFrame: {
      width: '100%',
      height: '100%',
    },

    image: {
      width: '100%',
      height: '100%',
    },

    pressed: {
      opacity: 0.72,
    },
  });
