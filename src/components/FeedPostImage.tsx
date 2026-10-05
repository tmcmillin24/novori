import { moderationMediaUrl } from '../lib/moderation-media-url';
import { Ionicons } from '@expo/vector-icons';
import FullScreenImageViewer from './FullScreenImageViewer';
import {
    useMemo,
    useState,
} from 'react';
import {
    ColorValue,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
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
            uri: moderationMediaUrl(uri),
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

      <FullScreenImageViewer
        visible={
          fullScreenVisible
        }
        uri={
          uri
        }
        onClose={() =>
          setFullScreenVisible(
            false
          )
        }
      />
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
    pressed: {
      opacity:
        0.92,
    },
  });
}
