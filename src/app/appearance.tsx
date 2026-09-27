import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  getReadingThemeSwatches,
  NovoriColors,
  NovoriReadingThemeName,
  NovoriThemeName,
  READING_THEME_LABELS,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';

type CoreThemeOptionProps = {
  title: string;
  subtitle: string;
  icon:
    keyof typeof Ionicons.glyphMap;
  selected: boolean;
  colors: NovoriColors;
  onPress: () => void;
};

function CoreThemeOption({
  title,
  subtitle,
  icon,
  selected,
  colors,
  onPress,
}: CoreThemeOptionProps) {
  const styles =
    createStyles(
      colors
    );

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.option,
        selected &&
          styles.optionSelected,
        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          selected &&
            styles.optionIconSelected,
        ]}
      >
        <Ionicons
          name={
            icon
          }
          size={
            21
          }
          color={
            selected
              ? colors.gold
              : colors.secondaryText
          }
        />
      </View>

      <View
        style={
          styles.optionText
        }
      >
        <Text
          style={
            styles.optionTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.optionSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.radio,
          selected &&
            styles.radioSelected,
        ]}
      >
        {selected ? (
          <View
            style={
              styles.radioDot
            }
          />
        ) : null}
      </View>
    </Pressable>
  );
}

type ReadingThemeOptionProps = {
  value:
    NovoriReadingThemeName;
  theme:
    NovoriThemeName;
  selected: boolean;
  colors: NovoriColors;
  onPress: () => void;
};

function ReadingThemeOption({
  value,
  theme,
  selected,
  colors,
  onPress,
}: ReadingThemeOptionProps) {
  const styles =
    createStyles(
      colors
    );

  const swatches =
    getReadingThemeSwatches(
      value,
      theme
    );

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.readingThemeRow,
        selected &&
          styles.readingThemeRowSelected,
        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={
          styles.swatchGroup
        }
      >
        {swatches.map(
          (
            swatch,
            index
          ) => (
            <View
              key={
                `${value}-${index}`
              }
              style={[
                styles.swatch,
                {
                  backgroundColor:
                    swatch,
                },
              ]}
            />
          )
        )}
      </View>

      <Text
        style={
          styles.readingThemeTitle
        }
      >
        {
          READING_THEME_LABELS[
            value
          ]
        }
      </Text>

      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={
            20
          }
          color={
            colors.gold
          }
        />
      ) : (
        <View
          style={
            styles.readingThemeCheckSpacer
          }
        />
      )}
    </Pressable>
  );
}

const READING_THEMES:
  NovoriReadingThemeName[] = [
    'classic',
    'fantasy',
    'romance',
    'scifi',
    'history',
    'mystery',
    'horror',
  ];

export default function AppearanceScreen() {
  const router =
    useRouter();

  const {
    theme,
    readingTheme,
    colors,
    setTheme,
    setReadingTheme,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  async function chooseTheme(
    nextTheme:
      NovoriThemeName
  ) {
    if (
      nextTheme ===
      theme
    ) {
      return;
    }

    await setTheme(
      nextTheme
    );
  }

  async function chooseReadingTheme(
    nextReadingTheme:
      NovoriReadingThemeName
  ) {
    if (
      nextReadingTheme ===
      readingTheme
    ) {
      return;
    }

    await setReadingTheme(
      nextReadingTheme
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'top',
        'bottom',
      ]}
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          hitSlop={
            10
          }
          style={({
            pressed,
          }) => [
            styles.backButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={
              24
            }
            color={
              colors.text
            }
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          Appearance
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <Text
          style={
            styles.sectionLabel
          }
        >
          THEME
        </Text>

        <Text
          style={
            styles.description
          }
        >
          Choose the light or dark foundation for Novori.
        </Text>

        <View
          style={
            styles.options
          }
        >
          <CoreThemeOption
            title="Dark"
            subtitle="Novori's charcoal foundation"
            icon="moon-outline"
            selected={
              theme ===
              'dark'
            }
            colors={
              colors
            }
            onPress={() =>
              chooseTheme(
                'dark'
              )
            }
          />

          <CoreThemeOption
            title="Light"
            subtitle="Warm ivory with dark text"
            icon="sunny-outline"
            selected={
              theme ===
              'light'
            }
            colors={
              colors
            }
            onPress={() =>
              chooseTheme(
                'light'
              )
            }
          />
        </View>

        <Text
          style={[
            styles.sectionLabel,
            styles.readingSectionLabel,
          ]}
        >
          READING THEME
        </Text>

        <Text
          style={
            styles.description
          }
        >
          Add a genre-inspired palette without changing your light or dark setting.
        </Text>

        <View
          style={
            styles.readingThemeCard
          }
        >
          {READING_THEMES.map(
            (
              value,
              index
            ) => (
              <View
                key={
                  value
                }
              >
                <ReadingThemeOption
                  value={
                    value
                  }
                  theme={
                    theme
                  }
                  selected={
                    readingTheme ===
                    value
                  }
                  colors={
                    colors
                  }
                  onPress={() =>
                    chooseReadingTheme(
                      value
                    )
                  }
                />

                {index <
                READING_THEMES.length -
                  1 ? (
                  <View
                    style={
                      styles.rowDivider
                    }
                  />
                ) : null}
              </View>
            )
          )}
        </View>

        <View
          style={
            styles.preview
          }
        >
          <Text
            style={
              styles.previewLabel
            }
          >
            PREVIEW
          </Text>

          <View
            style={
              styles.previewCard
            }
          >
            <View
              style={
                styles.previewAccent
              }
            />

            <Text
              style={
                styles.previewTitle
              }
            >
              Novori
            </Text>

            <Text
              style={
                styles.previewText
              }
            >
              {
                READING_THEME_LABELS[
                  readingTheme
                ]
              } · {theme === 'dark'
                ? 'Dark'
                : 'Light'}
            </Text>

            <Text
              style={
                styles.previewSubtext
              }
            >
              Read. Discuss. Belong.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(
  colors:
    NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },

    header: {
      height:
        56,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
    },

    backButton: {
      width:
        40,
      height:
        40,
      borderRadius:
        20,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerTitle: {
      flex:
        1,
      color:
        colors.text,
      fontSize:
        20,
      fontFamily:
        'PlayfairDisplay_700Bold',
      textAlign:
        'center',
    },

    headerSpacer: {
      width:
        40,
    },

    content: {
      width:
        '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop:
        26,
      paddingBottom:
        44,
    },

    sectionLabel: {
      color:
        colors.mutedText,
      fontSize:
        11,
      letterSpacing:
        0.9,
      fontFamily:
        'Inter_700Bold',
    },

    readingSectionLabel: {
      marginTop:
        30,
    },

    description: {
      color:
        colors.secondaryText,
      fontSize:
        13,
      lineHeight:
        19,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        7,
      marginBottom:
        14,
    },

    options: {
      gap:
        10,
    },

    option: {
      minHeight:
        72,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        colors.surface,
      borderRadius:
        16,
      borderWidth:
        1,
      borderColor:
        colors.border,
      paddingHorizontal:
        14,
      paddingVertical:
        12,
    },

    optionSelected: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },

    optionIcon: {
      width:
        42,
      height:
        42,
      borderRadius:
        13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginRight:
        12,
    },

    optionIconSelected: {
      backgroundColor:
        colors.surface,
    },

    optionText: {
      flex:
        1,
      minWidth:
        0,
    },

    optionTitle: {
      color:
        colors.text,
      fontSize:
        14,
      fontFamily:
        'Inter_700Bold',
    },

    optionSubtitle: {
      color:
        colors.secondaryText,
      fontSize:
        11.5,
      lineHeight:
        16,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        3,
    },

    radio: {
      width:
        20,
      height:
        20,
      borderRadius:
        10,
      borderWidth:
        1.5,
      borderColor:
        colors.mutedText,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginLeft:
        10,
    },

    radioSelected: {
      borderColor:
        colors.gold,
    },

    radioDot: {
      width:
        10,
      height:
        10,
      borderRadius:
        5,
      backgroundColor:
        colors.gold,
    },

    readingThemeCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        18,
      overflow:
        'hidden',
    },

    readingThemeRow: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      paddingVertical:
        10,
    },

    readingThemeRowSelected: {
      backgroundColor:
        colors.elevated,
    },

    swatchGroup: {
      width:
        54,
      height:
        30,
      flexDirection:
        'row',
      overflow:
        'hidden',
      borderRadius:
        9,
      borderWidth:
        1,
      borderColor:
        colors.border,
      marginRight:
        12,
    },

    swatch: {
      flex:
        1,
    },

    readingThemeTitle: {
      flex:
        1,
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },

    readingThemeCheckSpacer: {
      width:
        20,
    },

    rowDivider: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        colors.border,
      marginLeft:
        80,
    },

    preview: {
      marginTop:
        30,
    },

    previewLabel: {
      color:
        colors.mutedText,
      fontSize:
        11,
      letterSpacing:
        0.9,
      fontFamily:
        'Inter_700Bold',
      marginBottom:
        10,
    },

    previewCard: {
      backgroundColor:
        colors.surface,
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        colors.border,
      padding:
        18,
      overflow:
        'hidden',
    },

    previewAccent: {
      width:
        42,
      height:
        4,
      borderRadius:
        2,
      backgroundColor:
        colors.gold,
      marginBottom:
        13,
    },

    previewTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        24,
    },

    previewText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
      marginTop:
        6,
    },

    previewSubtext: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      marginTop:
        5,
    },

    pressed: {
      opacity:
        0.72,
    },
  });
}
