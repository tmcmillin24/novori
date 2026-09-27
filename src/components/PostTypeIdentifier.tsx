import { Ionicons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  FeedPostType,
} from '../lib/feed';

type Props = {
  postType: FeedPostType;
  rating?: number | null;
  colors: NovoriColors;
};

type Identity = {
  label: string;
  icon:
    keyof typeof Ionicons.glyphMap;
};

function getIdentity(
  postType: FeedPostType
): Identity | null {
  switch (
    postType
  ) {
    case 'question':
      return {
        label:
          'ASK READERS',
        icon:
          'help-circle-outline',
      };

    case 'reading_update':
      return {
        label:
          'READING UPDATE',
        icon:
          'book-outline',
      };

    case 'review':
      return {
        label:
          'REVIEW',
        icon:
          'star-outline',
      };

    default:
      return null;
  }
}

export default function PostTypeIdentifier({
  postType,
  rating = null,
  colors,
}: Props) {
  const identity =
    getIdentity(
      postType
    );

  if (!identity) {
    return null;
  }

  const styles =
    createStyles(
      colors
    );

  return (
    <View
      style={
        styles.row
      }
    >
      <View
        style={
          styles.accent
        }
      />

      <Ionicons
        name={
          identity.icon
        }
        size={
          13
        }
        color={
          colors.gold
        }
      />

      <Text
        style={
          styles.label
        }
      >
        {
          identity.label
        }
      </Text>

      {postType ===
        'review' &&
      rating ? (
        <>
          <View
            style={
              styles.dot
            }
          />

          <Text
            style={
              styles.rating
            }
          >
            {rating} ★
          </Text>
        </>
      ) : null}
    </View>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    row: {
      alignSelf:
        'flex-start',
      minHeight:
        26,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
      paddingLeft:
        8,
      paddingRight:
        10,
      borderRadius:
        999,
      backgroundColor:
        colors.elevated,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      overflow:
        'hidden',
      marginBottom:
        10,
    },

    accent: {
      width:
        2,
      alignSelf:
        'stretch',
      backgroundColor:
        colors.gold,
      marginLeft:
        -8,
      marginRight:
        1,
    },

    label: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9.5,
      letterSpacing:
        0.9,
    },

    dot: {
      width:
        3,
      height:
        3,
      borderRadius:
        2,
      backgroundColor:
        colors.mutedText,
      marginHorizontal:
        1,
    },

    rating: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9.5,
    },
  });
}
