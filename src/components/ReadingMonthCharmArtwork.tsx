import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getReadingMonthCharmOption,
  ReadingMonthCharm,
} from '../lib/reading-month-charms';

type Props = {
  charm:
    ReadingMonthCharm;
  size?:
    number;
};

export default function ReadingMonthCharmArtwork({
  charm,
  size =
    44,
}: Props) {
  const option =
    getReadingMonthCharmOption(
      charm
    );

  if (
    !option
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.canvas,
        {
          width:
            size,
          height:
            size,
        },
      ]}
    >
      <Text
        allowFontScaling={
          false
        }
        style={[
          styles.emoji,
          {
            fontSize:
              size *
              0.84,
            lineHeight:
              size,
          },
        ]}
      >
        {
          option.emoji
        }
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    canvas: {
      alignItems:
        'center',
      justifyContent:
        'center',
      overflow:
        'visible',
    },
    emoji: {
      textAlign:
        'center',
      includeFontPadding:
        false,
    },
  });
