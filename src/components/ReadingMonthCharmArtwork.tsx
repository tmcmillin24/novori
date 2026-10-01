import {
  Ionicons,
} from '@expo/vector-icons';
import {
  StyleSheet,
  View,
} from 'react-native';

import {
  ReadingMonthCharm,
} from '../lib/reading-month-personalization';

type Props = {
  charm:
    ReadingMonthCharm;
  size?:
    number;
};

export default function ReadingMonthCharmArtwork({
  charm,
  size =
    40,
}: Props) {
  const scale =
    size /
    40;

  if (
    charm ===
    'plant'
  ) {
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
        <Ionicons
          name="leaf"
          size={
            15 *
            scale
          }
          color="#3DDB70"
          style={[
            styles.plantLeaf,
            {
              left:
                4 *
                scale,
              top:
                3 *
                scale,
              transform: [
                {
                  rotate:
                    '-28deg',
                },
              ],
            },
          ]}
        />

        <Ionicons
          name="leaf"
          size={
            16 *
            scale
          }
          color="#78F09B"
          style={[
            styles.plantLeaf,
            {
              right:
                3 *
                scale,
              top:
                4 *
                scale,
              transform: [
                {
                  rotate:
                    '34deg',
                },
              ],
            },
          ]}
        />

        <Ionicons
          name="leaf"
          size={
            15 *
            scale
          }
          color="#22BF55"
          style={[
            styles.plantLeaf,
            {
              left:
                10 *
                scale,
              top:
                0,
              transform: [
                {
                  rotate:
                    '4deg',
                },
              ],
            },
          ]}
        />

        <View
          style={[
            styles.pot,
            {
              width:
                19 *
                scale,
              height:
                12 *
                scale,
              left:
                7.5 *
                scale,
              bottom:
                1 *
                scale,
              borderBottomLeftRadius:
                6 *
                scale,
              borderBottomRightRadius:
                6 *
                scale,
              borderTopLeftRadius:
                2 *
                scale,
              borderTopRightRadius:
                2 *
                scale,
            },
          ]}
        />
      </View>
    );
  }

  if (
    charm ===
    'cat'
  ) {
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
        <Ionicons
          name="caret-up"
          size={
            12 *
            scale
          }
          color="#FFB45C"
          style={[
            styles.catEar,
            {
              left:
                4 *
                scale,
              top:
                1 *
                scale,
              transform: [
                {
                  rotate:
                    '-18deg',
                },
              ],
            },
          ]}
        />

        <Ionicons
          name="caret-up"
          size={
            12 *
            scale
          }
          color="#FFB45C"
          style={[
            styles.catEar,
            {
              right:
                4 *
                scale,
              top:
                1 *
                scale,
              transform: [
                {
                  rotate:
                    '18deg',
                },
              ],
            },
          ]}
        />

        <View
          style={[
            styles.catFace,
            {
              width:
                24 *
                scale,
              height:
                22 *
                scale,
              left:
                5 *
                scale,
              top:
                8 *
                scale,
              borderRadius:
                11 *
                scale,
            },
          ]}
        >
          <View
            style={[
              styles.catEye,
              {
                left:
                  6 *
                  scale,
                top:
                  7 *
                  scale,
                width:
                  2.5 *
                  scale,
                height:
                  2.5 *
                  scale,
                borderRadius:
                  2 *
                  scale,
              },
            ]}
          />

          <View
            style={[
              styles.catEye,
              {
                right:
                  6 *
                  scale,
                top:
                  7 *
                  scale,
                width:
                  2.5 *
                  scale,
                height:
                  2.5 *
                  scale,
                borderRadius:
                  2 *
                  scale,
              },
            ]}
          />

          <View
            style={[
              styles.catNose,
              {
                left:
                  10 *
                  scale,
                top:
                  12 *
                  scale,
                width:
                  4 *
                  scale,
                height:
                  2.5 *
                  scale,
                borderRadius:
                  2 *
                  scale,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  const config:
    Record<
      Exclude<
        ReadingMonthCharm,
        'plant' | 'cat'
      >,
      {
        icon:
          keyof typeof Ionicons.glyphMap;
        color:
          string;
      }
    > = {
      sun: {
        icon:
          'sunny',
        color:
          '#FFE05A',
      },
      mug: {
        icon:
          'cafe',
        color:
          '#EB8D54',
      },
      moon: {
        icon:
          'moon',
        color:
          '#A58CFF',
      },
      headphones: {
        icon:
          'headset',
        color:
          '#4EA8FF',
      },
      flower: {
        icon:
          'flower',
        color:
          '#FF7CBC',
      },
      globe: {
        icon:
          'earth',
        color:
          '#32D1CA',
      },
    };

  const visual =
    config[
      charm as Exclude<
        ReadingMonthCharm,
        'plant' | 'cat'
      >
    ];

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
      <Ionicons
        name={
          visual.icon
        }
        size={
          size
        }
        color={
          visual.color
        }
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    canvas: {
      position:
        'relative',
      alignItems:
        'center',
      justifyContent:
        'center',
      overflow:
        'visible',
    },
    plantLeaf: {
      position:
        'absolute',
    },
    pot: {
      position:
        'absolute',
      backgroundColor:
        '#E8894D',
      borderTopWidth:
        1,
      borderTopColor:
        '#FFAA74',
    },
    catEar: {
      position:
        'absolute',
    },
    catFace: {
      position:
        'absolute',
      backgroundColor:
        '#FFB45C',
    },
    catEye: {
      position:
        'absolute',
      backgroundColor:
        '#4B3525',
    },
    catNose: {
      position:
        'absolute',
      backgroundColor:
        '#8E5038',
    },
  });
