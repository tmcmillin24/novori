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
} from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

export default function FullScreenImageViewer({
  visible,
  uri,
  onClose,
}: Props) {
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
          style={
            styles.header
          }
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
          <Image
            source={{
              uri,
            }}
            style={
              styles.image
            }
            resizeMode="contain"
          />
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
      height: 58,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'flex-end',
      paddingHorizontal: 14,
    },

    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
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

    image: {
      width: '100%',
      height: '100%',
    },

    pressed: {
      opacity: 0.72,
    },
  });
