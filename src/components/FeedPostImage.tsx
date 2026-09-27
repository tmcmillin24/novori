import { Ionicons } from '@expo/vector-icons';
import {
    useMemo,
    useState,
} from 'react';
import {
    ColorValue,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    NovoriColors,
} from '../constants/novori-theme';

type FeedPostColors = {
  [Key in keyof NovoriColors]: ColorValue;
};

type FeedPostImageProps = {
  uri: string;
  colors: FeedPostColors;
};

const MIN_FEED_ASPECT_RATIO =
  0.72;

export default function FeedPostImage({
  uri,
  colors,
}: FeedPostImageProps) {
  const styles =
    useMemo(
      () =>
        createStyles(
          colors
        ),
      [
        colors,
      ]
    );

  const [
    naturalAspectRatio,
    setNaturalAspectRatio,
  ] =
    useState<number | null>(
      null
    );

  const [
    fullScreenVisible,
    setFullScreenVisible,
  ] =
    useState(false);

  const feedAspectRatio =
    naturalAspectRatio
      ? Math.max(
          naturalAspectRatio,
          MIN_FEED_ASPECT_RATIO
        )
      : 1;

  const isHeightCapped =
    Boolean(
      naturalAspectRatio &&
      naturalAspectRatio <
        MIN_FEED_ASPECT_RATIO
    );

  return (
    <>
      <Pressable
        onPress={() =>
          setFullScreenVisible(
            true
          )
        }
        style={({
          pressed,
        }) => [
          styles.imageShell,
          {
            aspectRatio:
              feedAspectRatio,
          },
          pressed &&
            styles.pressed,
        ]}
      >
        <Image
          source={{
            uri,
          }}
          style={
            styles.image
          }
          resizeMode={
            isHeightCapped
              ? 'cover'
              : 'contain'
          }
          onLoad={(
            event
          ) => {
            const {
              width,
              height,
            } =
              event.nativeEvent
                .source;

            if (
              width >
                0 &&
              height >
                0
            ) {
              setNaturalAspectRatio(
                width /
                  height
              );
            }
          }}
        />

        {isHeightCapped ? (
          <View
            pointerEvents="none"
            style={
              styles.fullPhotoHint
            }
          >
            <Ionicons
              name="expand-outline"
              size={
                14
              }
              color="#FFFFFF"
            />

            <Text
              style={
                styles.fullPhotoHintText
              }
            >
              View full photo
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={
          fullScreenVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setFullScreenVisible(
            false
          )
        }
      >
        <SafeAreaView
          style={
            styles.fullScreen
          }
        >
          <Pressable
            onPress={() =>
              setFullScreenVisible(
                false
              )
            }
            hitSlop={
              10
            }
            style={
              styles.closeButton
            }
          >
            <Ionicons
              name="close"
              size={
                26
              }
              color="#FFFFFF"
            />
          </Pressable>

          <Image
            source={{
              uri,
            }}
            style={
              styles.fullScreenImage
            }
            resizeMode="contain"
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function createStyles(
  colors:
    FeedPostColors
) {
  return StyleSheet.create({
    imageShell: {
      width:
        '100%',
      marginTop:
        13,
      borderRadius:
        18,
      overflow:
        'hidden',
      backgroundColor:
        colors.elevated,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },
    image: {
      width:
        '100%',
      height:
        '100%',
      backgroundColor:
        colors.elevated,
    },
    fullPhotoHint: {
      position:
        'absolute',
      left:
        10,
      bottom:
        10,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
      backgroundColor:
        'rgba(0,0,0,0.72)',
      borderRadius:
        999,
      paddingHorizontal:
        10,
      paddingVertical:
        7,
    },
    fullPhotoHintText: {
      color:
        '#FFFFFF',
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10,
    },
    fullScreen: {
      flex:
        1,
      backgroundColor:
        'rgba(0,0,0,0.96)',
    },
    fullScreenImage: {
      flex:
        1,
      width:
        '100%',
    },
    closeButton: {
      position:
        'absolute',
      top:
        10,
      right:
        14,
      zIndex:
        2,
      width:
        42,
      height:
        42,
      borderRadius:
        21,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(25,25,25,0.82)',
    },
    pressed: {
      opacity:
        0.92,
    },
  });
}
