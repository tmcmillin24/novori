import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  NovoriColors,
} from '../../constants/novori-theme';
import {
  useNovoriTheme,
} from '../../context/theme-context';

type GridOptionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  stackVisual?: boolean;
};

function GridOption({
  icon,
  title,
  subtitle,
  onPress,
  stackVisual = false,
}: GridOptionProps) {
  const {
    width,
  } =
    useWindowDimensions();

  const tablet =
    width >=
    768;
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        title
      }
      accessibilityHint={
        subtitle
      }
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.gridCard,
        tablet &&
          styles.gridCardTablet,
        pressed &&
          styles.cardPressed,
      ]}
    >
      <View
        style={
          styles.gridCardTop
        }
      >
        <View
          style={
            styles.gridIconWrap
          }
        >
          <Ionicons
            name={
              icon
            }
            size={
              21
            }
            color={
              colors.gold
            }
          />
        </View>

        {stackVisual ? (
          <View
            style={
              styles.stackPreview
            }
          >
            <View
              style={[
                styles.stackBook,
                styles.stackBookBack,
              ]}
            />
            <View
              style={[
                styles.stackBook,
                styles.stackBookMiddle,
              ]}
            />
            <View
              style={[
                styles.stackBook,
                styles.stackBookFront,
              ]}
            />
          </View>
        ) : (
          <Ionicons
            name="arrow-forward"
            size={17}
            color={
              colors.mutedText
            }
          />
        )}
      </View>

      <View>
        <Text
          style={
            styles.gridTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.gridSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

// Phase 1 locked Create routes:
// Post -> /create-post
// Reading Update -> /create-reading-update
// Review a Book -> /create-review
// Ask Readers -> /ask-readers
// Book Stack -> /create-book-stack
export default function PostScreen() {
  const router =
    useRouter();

  const {
    width,
  } =
    useWindowDimensions();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const compactPhone =
    width <
    360;

  const tablet =
    width >=
    768;

  const largeTablet =
    width >=
    1024;

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'top',
      ]}
    >
      <ScrollView
        style={
          styles.screen
        }
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={[
            styles.content,
            tablet &&
              styles.contentTablet,
            largeTablet &&
              styles.contentLargeTablet,
          ]}
        >
          <View
            style={[
              styles.header,
              tablet &&
                styles.headerTablet,
            ]}
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              CREATE
            </Text>

            <Text
              style={[
                styles.title,
                tablet &&
                  styles.titleTablet,
              ]}
            >
              What do you want to create?
            </Text>

            <Text
              style={[
                styles.subtitle,
                tablet &&
                  styles.subtitleTablet,
              ]}
            >
              Share with readers, track your reading life, or build something just for you.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post"
            accessibilityHint="Create a new social post."
            onPress={() =>
              router.push(
                '/create-post'
              )
            }
            style={({
              pressed,
            }) => [
              styles.primaryCard,
              tablet &&
                styles.primaryCardTablet,
              pressed &&
                styles.cardPressed,
            ]}
          >
            <View
              style={
                styles.primaryAccent
              }
            />

            <View
              style={
                styles.primaryContent
              }
            >
              <View
                style={
                  styles.primaryIconWrap
                }
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={25}
                  color={
                    colors.gold
                  }
                />
              </View>

              <View
                style={
                  styles.primaryCopy
                }
              >
                <Text
                  style={
                    styles.primaryLabel
                  }
                >
                  Post
                </Text>

                <Text
                  style={
                    styles.primarySubtitle
                  }
                >
                  Share a thought, reaction, recommendation, or discussion with your readers.
                </Text>
              </View>

              <View
                style={
                  styles.primaryArrow
                }
              >
                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color={
                    colors.gold
                  }
                />
              </View>
            </View>
          </Pressable>

          <View
            style={
              styles.sectionHeading
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              More ways to create
            </Text>

            <Text
              style={
                styles.sectionHint
              }
            >
              Choose a format
            </Text>
          </View>

          <View
            style={[
              styles.grid,
              compactPhone &&
                styles.gridCompact,
              tablet &&
                styles.gridTablet,
            ]}
          >
            <GridOption
              icon="book-outline"
              title="Reading Update"
              subtitle="Share where you are and what you think so far."
              onPress={() =>
                router.push(
                  '/create-reading-update'
                )
              }
            />

            <GridOption
              icon="star-outline"
              title="Review a Book"
              subtitle="Rate a finished read and share your take."
              onPress={() =>
                router.push(
                  '/create-review'
                )
              }
            />

            <GridOption
              icon="help-circle-outline"
              title="Ask Readers"
              subtitle="Start with a question and invite the community in."
              onPress={() =>
                router.push(
                  '/ask-readers'
                )
              }
            />

            <GridOption
              icon="albums-outline"
              title="Book Stack"
              subtitle="Build and save a collection of books your way."
              stackVisual
              onPress={() =>
                router.push(
                  '/create-book-stack'
                )
              }
            />
          </View>

          <View
            style={
              styles.footerNote
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={13}
              color={
                colors.mutedText
              }
            />

            <Text
              style={
                styles.footerText
              }
            >
              Book Stacks can be saved privately before you decide to share them.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },
    screen: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },
    scrollContent: {
      flexGrow:
        1,
      paddingTop:
        20,
      paddingBottom:
        120,
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
    },
    contentTablet: {
      maxWidth:
        780,
      paddingHorizontal:
        30,
    },
    contentLargeTablet: {
      maxWidth:
        820,
    },
    header: {
      marginBottom:
        20,
    },
    headerTablet: {
      marginBottom:
        24,
    },
    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10.5,
      letterSpacing:
        1.7,
      marginBottom:
        7,
    },
    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        34,
      lineHeight:
        40,
      maxWidth:
        560,
    },
    titleTablet: {
      fontSize:
        38,
      lineHeight:
        45,
      maxWidth:
        650,
    },
    subtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      lineHeight:
        21,
      marginTop:
        9,
      maxWidth:
        570,
    },
    subtitleTablet: {
      fontSize:
        15,
      lineHeight:
        23,
      maxWidth:
        640,
    },
    primaryCard: {
      position:
        'relative',
      overflow:
        'hidden',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        22,
      marginBottom:
        20,
    },
    primaryCardTablet: {
      marginBottom:
        24,
    },
    primaryAccent: {
      height:
        3,
      width:
        '100%',
      backgroundColor:
        colors.gold,
      opacity:
        0.8,
    },
    primaryContent: {
      minHeight:
        112,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        16,
      paddingVertical:
        17,
    },
    primaryIconWrap: {
      width:
        54,
      height:
        54,
      borderRadius:
        18,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        14,
    },
    primaryCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    primaryLabel: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        17,
    },
    primarySubtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        18,
      marginTop:
        5,
      maxWidth:
        490,
    },
    primaryArrow: {
      width:
        34,
      height:
        34,
      borderRadius:
        17,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginLeft:
        10,
    },
    sectionHeading: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom:
        10,
    },
    sectionTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13.5,
    },
    sectionHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10.5,
    },
    grid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      justifyContent:
        'space-between',
      rowGap:
        12,
    },
    gridCompact: {
      rowGap:
        10,
    },
    gridTablet: {
      rowGap:
        14,
    },
    gridCard: {
      width:
        '48.4%',
      minHeight:
        166,
      justifyContent:
        'space-between',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        19,
      padding:
        14,
    },
    gridCardTablet: {
      minHeight:
        174,
      padding:
        16,
    },
    gridCardTop: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      minHeight:
        42,
    },
    gridIconWrap: {
      width:
        40,
      height:
        40,
      borderRadius:
        13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    gridTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
      lineHeight:
        18,
    },
    gridSubtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      lineHeight:
        16,
      marginTop:
        5,
    },
    stackPreview: {
      width:
        48,
      height:
        38,
      position:
        'relative',
      marginTop:
        1,
    },
    stackBook: {
      position:
        'absolute',
      width:
        22,
      height:
        32,
      borderRadius:
        4,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
    },
    stackBookBack: {
      right:
        0,
      top:
        4,
      transform: [
        {
          rotate:
            '8deg',
        },
      ],
      opacity:
        0.58,
    },
    stackBookMiddle: {
      right:
        12,
      top:
        2,
      transform: [
        {
          rotate:
            '2deg',
        },
      ],
      opacity:
        0.8,
    },
    stackBookFront: {
      right:
        24,
      top:
        0,
      borderColor:
        colors.gold,
      backgroundColor:
        colors.surface,
    },
    footerNote: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
      marginTop:
        16,
      paddingHorizontal:
        2,
    },
    footerText: {
      flex:
        1,
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
    },
    cardPressed: {
      opacity:
        0.72,
      transform: [
        {
          scale:
            0.99,
        },
      ],
    },
  });
}
