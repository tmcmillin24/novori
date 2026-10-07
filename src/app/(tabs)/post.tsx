import { Ionicons } from '@expo/vector-icons';
import {useEffect,useRef,useState} from 'react';
import {useTutorial,useTutorialTarget} from '../../context/tutorial-context';
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

export default function PostScreen() {
  const tutorial=useTutorial(),postTarget=useTutorialTarget('create-post'),readingTarget=useTutorialTarget('create-reading-update'),askTarget=useTutorialTarget('create-ask-readers'),stackTarget=useTutorialTarget('create-book-stack'),scroll=useRef<ScrollView>(null);
  const [positions,setPositions]=useState<Record<string,number>>({}),[gridY,setGridY]=useState(0);
  const recordPosition=(id:string,y:number)=>setPositions(old=>old[id]===y?old:{...old,[id]:y});
  useEffect(()=>{
    if(tutorial?.active&&tutorial.step.path==='/post'){
      const anchor=tutorial.step.anchor,y=positions[anchor];
      scroll.current?.scrollTo({y:y===undefined?0:Math.max(0,y+(anchor==='create-ask-readers'||anchor==='create-book-stack'?gridY:0)-20),animated:false});
    }
  },[tutorial?.active,tutorial?.step.anchor,positions,gridY]);
  const router =
    useRouter();

  const { width } =
    useWindowDimensions();

  const { colors } =
    useNovoriTheme();

  const styles =
    createStyles(colors);

  const tablet =
    width >= 768;

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={['top']}
    >
      <ScrollView
        ref={scroll}
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
          ]}
        >
          <View
            style={
              styles.header
            }
          >
            <View
              style={
                styles.headerMark
              }
            >
              <View
                style={
                  styles.headerMarkLine
                }
              />
              <Text
                style={
                  styles.eyebrow
                }
              >
                CREATE
              </Text>
            </View>

            <Text
              style={[
                styles.title,
                tablet &&
                  styles.titleTablet,
              ]}
            >
              Make something worth sharing.
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Start a conversation, share where you are in a book, or build something readers can come back to.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post"
            ref={postTarget.ref} onLayout={event=>{postTarget.onLayout();recordPosition('create-post',event.nativeEvent.layout.y);}}
            accessibilityHint="Create a new social post."
            onPress={() =>
              router.push(
                '/create-post'
              )
            }
            style={({ pressed }) => [
              styles.featureCard,
              pressed &&
                styles.pressed,
            ]}
          >
            <View
              style={
                styles.featureAccent
              }
            />

            <View
              style={
                styles.featureTop
              }
            >
              <View
                style={
                  styles.featureIcon
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
                  styles.featureArrow
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

            <Text
              style={
                styles.featureTitle
              }
            >
              Post
            </Text>

            <Text
              style={
                styles.featureSubtitle
              }
            >
              Share a thought, reaction, recommendation, photo, or discussion with your readers.
            </Text>

            <View
              style={
                styles.featureFooter
              }
            >
              <Ionicons
                name="people-outline"
                size={13}
                color={
                  colors.mutedText
                }
              />
              <Text
                style={
                  styles.featureFooterText
                }
              >
                Share to Feed or Club
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reading Update"
              ref={readingTarget.ref} onLayout={event=>{readingTarget.onLayout();recordPosition('create-reading-update',event.nativeEvent.layout.y);}}
            accessibilityHint="Share your reading progress."
            onPress={() =>
              router.push(
                '/create-reading-update'
              )
            }
            style={({ pressed }) => [
              styles.readingCard,
              pressed &&
                styles.pressed,
            ]}
          >
            <View
              style={
                styles.readingAccent
              }
            />

            <View
              style={
                styles.readingCardContent
              }
            >
              <View
                style={
                  styles.readingIcon
                }
              >
                <Ionicons
                  name="book-outline"
                  size={22}
                  color={
                    colors.gold
                  }
                />
              </View>

              <View
                style={
                  styles.readingCopy
                }
              >
                <Text
                  style={
                    styles.readingTitle
                  }
                >
                  Reading Update
                </Text>

                <Text
                  style={
                    styles.readingSubtitle
                  }
                >
                  Share your progress, chapter, or what you’re thinking so far.
                </Text>

                <View
                  style={
                    styles.readingMotif
                  }
                >
                  <View
                    style={
                      styles.readingBook
                    }
                  >
                    <View
                      style={
                        styles.readingBookLeft
                      }
                    />
                    <View
                      style={
                        styles.readingBookRight
                      }
                    />
                    <View
                      style={
                        styles.readingBookSpine
                      }
                    />

                    <View
                      style={
                        styles.readingBookmark
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.readingQuote
                    }
                  >
                    <Ionicons
                      name="chatbox-ellipses-outline"
                      size={14}
                      color={
                        colors.gold
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.readingMotifText
                    }
                  >
                    Progress · chapter · thought
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  colors.mutedText
                }
              />
            </View>
          </Pressable>

          <View
            style={
              styles.createDivider
            }
          >
            <View
              style={
                styles.createDividerLine
              }
            />

            <Text
              style={
                styles.createDividerText
              }
            >
              MORE WAYS TO CREATE
            </Text>

            <View
              style={
                styles.createDividerLine
              }
            />
          </View>

          <View
            style={
              styles.bottomGrid
            }
            onLayout={event=>setGridY(event.nativeEvent.layout.y)}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ask Readers"
              ref={askTarget.ref} onLayout={event=>{askTarget.onLayout();recordPosition('create-ask-readers',event.nativeEvent.layout.y);}}
              accessibilityHint="Ask readers a question."
              onPress={() =>
                router.push(
                  '/ask-readers'
                )
              }
              style={({ pressed }) => [
                styles.smallCard,
                styles.askReadersCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.askVisual
                }
              >
                <View
                  style={
                    styles.askBubbleBack
                  }
                />

                <View
                  style={
                    styles.askBubbleFront
                  }
                >
                  <Ionicons
                    name="help"
                    size={14}
                    color={
                      colors.gold
                    }
                  />
                </View>

                <View
                  style={
                    styles.askDots
                  }
                >
                  <View
                    style={
                      styles.askDot
                    }
                  />
                  <View
                    style={
                      styles.askDot
                    }
                  />
                  <View
                    style={
                      styles.askDot
                    }
                  />
                </View>
              </View>

              <Text
                style={
                  styles.smallTitle
                }
              >
                Ask Readers
              </Text>

              <Text
                style={
                  styles.smallSubtitle
                }
              >
                Start a question and pull the community in.
              </Text>

              <View
                style={
                  styles.smallBottom
                }
              >
                <Text
                  style={
                    styles.smallAction
                  }
                >
                  Ask
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={
                    colors.gold
                  }
                />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Book Stack"
              ref={stackTarget.ref} onLayout={event=>{stackTarget.onLayout();recordPosition('create-book-stack',event.nativeEvent.layout.y);}}
              accessibilityHint="Build and save a book stack."
              onPress={() =>
                router.push(
                  '/create-book-stack'
                )
              }
              style={({ pressed }) => [
                styles.smallCard,
                styles.stackCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.stackVisualWrap
                }
              >
                <View
                  style={
                    styles.stackMini
                  }
                >
                  <View
                    style={[
                      styles.stackMiniBook,
                      styles.stackMiniBack,
                    ]}
                  />
                  <View
                    style={[
                      styles.stackMiniBook,
                      styles.stackMiniMiddle,
                    ]}
                  />
                  <View
                    style={[
                      styles.stackMiniBook,
                      styles.stackMiniFront,
                    ]}
                  />
                </View>

                <View
                  style={
                    styles.stackAddMark
                  }
                >
                  <Ionicons
                    name="add"
                    size={14}
                    color={
                      colors.gold
                    }
                  />
                </View>
              </View>

              <Text
                style={
                  styles.smallTitle
                }
              >
                Book Stack
              </Text>

              <Text
                style={
                  styles.smallSubtitle
                }
              >
                Build a collection and keep it private until you share it.
              </Text>

              <View
                style={
                  styles.smallBottom
                }
              >
                <Text
                  style={
                    styles.smallAction
                  }
                >
                  Build
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={
                    colors.gold
                  }
                />
              </View>
            </Pressable>
          </View>

          <View
            style={
              styles.footerNote
            }
          >
            <Ionicons
              name="star-outline"
              size={14}
              color={
                colors.gold
              }
            />
            <Text
              style={
                styles.footerText
              }
            >
              Ratings and reviews live with the book in your Library.
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
      flex: 1,
      backgroundColor:
        colors.background,
    },

    screen: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    scrollContent: {
      flexGrow: 1,
      paddingTop: 20,
      paddingBottom: 120,
    },

    content: {
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'center',
      paddingHorizontal: 20,
    },

    contentTablet: {
      maxWidth: '100%',
      paddingHorizontal: 30,
    },

    header: {
      marginBottom: 22,
    },

    headerMark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },

    headerMarkLine: {
      width: 24,
      height: 1,
      backgroundColor:
        colors.gold,
    },

    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10.5,
      letterSpacing: 1.8,
    },

    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 34,
      lineHeight: 40,
      maxWidth: 580,
    },

    titleTablet: {
      fontSize: 39,
      lineHeight: 46,
    },

    subtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: 8,
      maxWidth: 610,
    },

    featureCard: {
      position: 'relative',
      overflow: 'hidden',
      minHeight: 186,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 22,
      padding: 18,
      paddingLeft: 21,
    },

    featureAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor:
        colors.gold,
    },

    featureTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    featureIcon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    featureArrow: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },

    featureTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 25,
      marginTop: 22,
    },

    featureSubtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12.5,
      lineHeight: 18,
      marginTop: 6,
      maxWidth: 520,
    },

    featureFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 17,
    },

    featureFooterText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10.5,
      letterSpacing: 0.4,
    },

    readingCard: {
      position: 'relative',
      overflow: 'hidden',
      minHeight: 116,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      marginTop: 12,
    },

    readingAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor:
        colors.gold,
    },

    readingCardContent: {
      minHeight: 116,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },

    readingIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginRight: 13,
    },

    readingCopy: {
      flex: 1,
      paddingRight: 12,
    },

    readingTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 15,
    },

    readingSubtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 4,
    },











    readingMotif: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 11,
      gap: 8,
    },

    readingBook: {
      width: 37,
      height: 24,
      position: 'relative',
    },

    readingBookLeft: {
      position: 'absolute',
      left: 0,
      top: 2,
      width: 18,
      height: 20,
      borderTopLeftRadius: 5,
      borderBottomLeftRadius: 5,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
    },

    readingBookRight: {
      position: 'absolute',
      right: 0,
      top: 2,
      width: 18,
      height: 20,
      borderTopRightRadius: 5,
      borderBottomRightRadius: 5,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
    },

    readingBookSpine: {
      position: 'absolute',
      left: 18,
      top: 3,
      width: 1,
      height: 18,
      backgroundColor:
        colors.gold,
      opacity: 0.65,
    },

    readingBookmark: {
      position: 'absolute',
      right: 5,
      top: 0,
      width: 4,
      height: 11,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      backgroundColor:
        colors.gold,
    },

    readingQuote: {
      width: 26,
      height: 26,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },

    readingMotifText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9.5,
      letterSpacing: 0.2,
    },

    createDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginTop: 18,
      marginBottom: 10,
    },

    createDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor:
        colors.border,
    },

    createDividerText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize: 8.5,
      letterSpacing: 1.2,
    },

    bottomGrid: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
      marginTop: 0,
    },

    smallCard: {
      flex: 1,
      minWidth: 0,
      minHeight: 184,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      padding: 14,
    },

    askReadersCard: {
      borderColor:
        colors.gold,
    },

    stackCard: {
      borderColor:
        colors.gold,
    },



    askVisual: {
      width: 64,
      height: 44,
      position: 'relative',
    },

    askBubbleBack: {
      position: 'absolute',
      width: 42,
      height: 26,
      left: 18,
      top: 2,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      opacity: 0.5,
    },

    askBubbleFront: {
      position: 'absolute',
      width: 46,
      height: 30,
      left: 0,
      top: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    askDots: {
      position: 'absolute',
      right: 2,
      bottom: 4,
      flexDirection: 'row',
      gap: 3,
    },

    askDot: {
      width: 3,
      height: 3,
      borderRadius: 999,
      backgroundColor:
        colors.mutedText,
      opacity: 0.55,
    },

    smallTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 14,
      marginTop: 16,
    },

    smallSubtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.75,
      lineHeight: 15,
      marginTop: 5,
      flex: 1,
    },

    smallBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 11,
    },

    smallAction: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10.5,
      letterSpacing: 0.25,
    },

    stackVisualWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      minHeight: 48,
    },

    stackMini: {
      width: 64,
      height: 46,
      position: 'relative',
    },

    stackMiniBook: {
      position: 'absolute',
      width: 29,
      height: 40,
      borderRadius: 5,
      borderWidth: 1,
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },

    stackMiniBack: {
      left: 29,
      top: 5,
      transform: [
        {
          rotate: '8deg',
        },
      ],
      opacity: 0.42,
    },

    stackMiniMiddle: {
      left: 15,
      top: 2,
      transform: [
        {
          rotate: '4deg',
        },
      ],
      opacity: 0.68,
    },

    stackMiniFront: {
      left: 0,
      top: 0,
    },

    stackAddMark: {
      width: 28,
      height: 28,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },

    footerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 7,
      marginTop: 18,
      paddingHorizontal: 8,
    },

    footerText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.75,
      lineHeight: 15,
      textAlign: 'center',
    },

    pressed: {
      opacity: 0.7,
      transform: [
        {
          scale: 0.992,
        },
      ],
    },
  });
}
