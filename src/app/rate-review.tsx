import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  useLocalSearchParams,

  useRouter,
} from 'expo-router';

import {
  useEffect,

  useState,
} from 'react';



import {
  ActivityIndicator,

  Alert,


  Platform,

  Pressable,
  StyleSheet,

  Text,

  TextInput,

  View
} from 'react-native';



import {
  SafeAreaView,
} from 'react-native-safe-area-context';



import {
  NovoriColors,
} from '../constants/novori-theme';



import {
  useNovoriTheme,
} from '../context/theme-context';



import {
  getUserBook,

  updateBookReview,

  UserBook,
} from '../lib/user-books';



export default function RateReviewScreen() {

  const router =

    useRouter();



  const {

    googleBookId,

  } =

    useLocalSearchParams<{

      googleBookId: string;

    }>();



  const {

    colors,

  } =

    useNovoriTheme();



  const styles =

    createStyles(colors);



  const [

    book,

    setBook,

  ] =

    useState<UserBook | null>(

      null

    );



  const [

    rating,

    setRating,

  ] =

    useState<number | null>(

      null

    );



  const [

    review,

    setReview,

  ] =

    useState('');



  const [

    loading,

    setLoading,

  ] =

    useState(true);



  const [

    saving,

    setSaving,

  ] =

    useState(false);




  const [

    saved,

    setSaved,

  ] =

    useState(false);



  useEffect(() => {

    let active = true;



    async function loadBook() {

      if (

        !googleBookId

      ) {

        return;

      }



      try {

        setLoading(true);



        const savedBook =

          await getUserBook(

            googleBookId

          );



        if (

          !active

        ) {

          return;

        }



        if (

          !savedBook

        ) {

          Alert.alert(

            'Book not found',

            'This book is not in your Novori library yet.'

          );



          router.back();



          return;

        }



        setBook(

          savedBook

        );



        setRating(

          savedBook.rating

        );



        setReview(

          savedBook.review_text ??

            ''

        );

      } catch (

        error

      ) {

        console.error(

          'Could not load review:',

          error

        );



        Alert.alert(

          'Could not load review',

          'Please try again.'

        );

      } finally {

        if (active) {

          setLoading(

            false

          );

        }

      }

    }



    loadBook();



    return () => {

      active = false;

    };

  }, [

    googleBookId,

    router,

  ]);



  function chooseRating(

    value: number

  ) {

    setRating(value);

  }



  async function saveReview() {

    if (

      !googleBookId

    ) {

      return;

    }



    try {

      setSaving(true);



      await updateBookReview({

        googleBookId,

        rating,

        reviewText: review.trim() || null,

      });



      if (

        book?.status ===

        'read'

      ) {

        setSaved(true);

        return;

      }



      router.back();

    } catch (

      error

    ) {

      console.error(

        'Could not save review:',

        error

      );



      Alert.alert(

        'Could not save review',

        'Novori had trouble saving your rating and review. Please try again.'

      );

    } finally {

      setSaving(false);

    }

  }



  function shareSavedReview() {

    if (

      !googleBookId

    ) {

      return;

    }



    router.replace({

      pathname:

        '/create-review',

      params: {

        bookId:

          googleBookId,

        rating:

          rating !== null

            ? String(rating)

            : '',

        review:

          review.trim(),

      },

    });

  }



  const isDNF =

    book?.status ===

    'dnf';



  const isRead =

    book?.status ===

    'read';



  if (

    saved &&

    isRead

  ) {

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

              size={25}

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

            Review Saved

          </Text>



          <View

            style={

              styles.headerSpacer

            }

          />

        </View>



        <View

          style={

            styles.savedContainer

          }

        >

          <View

            style={

              styles.savedIcon

            }

          >

            <Ionicons

              name="checkmark"

              size={30}

              color={

                colors.background

              }

            />

          </View>



          <Text

            style={

              styles.savedEyebrow

            }

          >

            SAVED TO YOUR LIBRARY

          </Text>



          <Text

            style={

              styles.savedTitle

            }

          >

            Your review is saved.

          </Text>



          <Text

            style={

              styles.savedText

            }

          >

            Your rating and review stay attached to {book.title}. Sharing is optional.

          </Text>



          <Pressable

            onPress={

              shareSavedReview

            }

            style={({

              pressed,

            }) => [

              styles.shareButton,



              pressed &&

                styles.saveButtonPressed,

            ]}

          >

            <Ionicons

              name="share-social-outline"

              size={19}

              color={

                colors.background

              }

            />



            <Text

              style={

                styles.shareButtonText

              }

            >

              Share this review

            </Text>

          </Pressable>



          <Pressable

            onPress={() =>

              router.back()

            }

            style={({

              pressed,

            }) => [

              styles.notNowButton,



              pressed &&

                styles.pressed,

            ]}

          >

            <Text

              style={

                styles.notNowText

              }

            >

              Not now

            </Text>

          </Pressable>

        </View>

      </SafeAreaView>

    );

  }



  if (loading) {

    return (

      <SafeAreaView

        style={

          styles.safeArea

        }

      >

        <View

          style={

            styles.loadingContainer

          }

        >

          <ActivityIndicator

            size="large"

            color={

              colors.gold

            }

          />



          <Text

            style={

              styles.loadingText

            }

          >

            Opening review...

          </Text>

        </View>

      </SafeAreaView>

    );

  }



  if (!book) {

    return null;

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
          styles.keyboardView
        }
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

              size={25}

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

            {isDNF

              ? 'Rate DNF'

              : 'Rate & Review'}

          </Text>



          <View

            style={

              styles.headerSpacer

            }

          />

        </View>



        <KeyboardAwareScrollView

          style={

            styles.scrollView

          }

          contentContainerStyle={

            styles.content

          }

          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS ===
            'ios'
              ? 'interactive'
              : 'on-drag'
          }
          bottomOffset={
            24
          }

          showsVerticalScrollIndicator={

            false

          }

        >

          <View

            style={

              styles.bookSection

            }

          >

            <Text

              style={

                styles.bookTitle

              }

            >

              {book.title}

            </Text>



            <Text

              style={

                styles.author

              }

            >

              {book.authors

                .length >

              0

                ? book.authors.join(

                    ', '

                  )

                : 'Unknown author'}

            </Text>



            <View

              style={[

                styles.statusBadge,



                isDNF &&

                  styles.dnfBadge,

              ]}

            >

              <Text

                style={[

                  styles.statusText,



                  isDNF &&

                    styles.dnfStatusText,

                ]}

              >

                {isDNF

                  ? 'DNF'

                  : isRead

                  ? 'READ'

                  : book.status

                      .replace(

                        /_/g,

                        ' '

                      )

                      .toUpperCase()}

              </Text>

            </View>

          </View>



          <View

            style={

              styles.divider

            }

          />



          <View

            style={

              styles.ratingSection

            }

          >

            <Text

              style={

                styles.sectionLabel

              }

            >

              YOUR RATING

            </Text>



            <Text

              style={

                styles.ratingHeading

              }

            >

              {rating

                ? `${rating.toFixed(

                    1

                  )} out of 5`

                : 'Choose a rating'}

            </Text>



            <View

              style={

                styles.starsRow

              }

            >

              {[

                1,

                2,

                3,

                4,

                5,

              ].map(

                (

                  starNumber

                ) => {

                  let icon:

                    | 'star'

                    | 'star-half'

                    | 'star-outline' =

                    'star-outline';



                  if (

                    rating !==

                      null &&

                    rating >=

                      starNumber

                  ) {

                    icon =

                      'star';

                  } else if (

                    rating !==

                      null &&

                    rating >=

                      starNumber -

                        0.5

                  ) {

                    icon =

                      'star-half';

                  }



                  return (

                    <View

                      key={

                        starNumber

                      }

                      style={

                        styles.starContainer

                      }

                    >

                      <Ionicons

                        name={

                          icon

                        }

                        size={38}

                        color={

                          colors.gold

                        }

                      />



                      <Pressable

                        onPress={() =>

                          chooseRating(

                            starNumber -

                              0.5

                          )

                        }

                        style={

                          styles.leftHalf

                        }

                      />



                      <Pressable

                        onPress={() =>

                          chooseRating(

                            starNumber

                          )

                        }

                        style={

                          styles.rightHalf

                        }

                      />

                    </View>

                  );

                }

              )}

            </View>



            <Text

              style={

                styles.ratingHint

              }

            >

              Tap the left or right

              half of a star for

              half-star ratings.

            </Text>



            {rating !==

            null ? (

              <Pressable

                onPress={() =>

                  setRating(

                    null

                  )

                }

                style={({

                  pressed,

                }) => [

                  styles.clearRatingButton,



                  pressed &&

                    styles.pressed,

                ]}

              >

                <Text

                  style={

                    styles.clearRatingText

                  }

                >

                  Clear rating

                </Text>

              </Pressable>

            ) : null}

          </View>



          <View

            style={

              styles.reviewSection

            }

          >

            <Text

              style={

                styles.sectionLabel

              }

            >

              REVIEW

            </Text>



            <Text

              style={

                styles.reviewHeading

              }

            >

              {isDNF

                ? 'Why did you stop?'

                : 'What did you think?'}

            </Text>



            <Text

              style={

                styles.reviewSubheading

              }

            >

              {isDNF

                ? 'Optional. You can explain why the book wasn’t for you without reviewing parts you didn’t read.'

                : 'Optional. Share a quick thought or write a full review.'}

            </Text>



            <TextInput

              value={

                review

              }

              onChangeText={

                setReview

              }

              placeholder={

                isDNF

                  ? 'I gave it a fair shot, but...'

                  : 'Write your review...'

              }

              placeholderTextColor={

                colors.mutedText

              }

              multiline

              textAlignVertical="top"

              maxLength={

                3000

              }

              style={

                styles.reviewInput

              }

            />



            <View

              style={

                styles.characterRow

              }

            >

              <Text

                style={

                  styles.optionalText

                }

              >

                Optional

              </Text>



              <Text

                style={

                  styles.characterCount

                }

              >

                {

                  review.length

                }

                /3000

              </Text>

            </View>

          </View>



          <Pressable

            disabled={

              saving

            }

            onPress={

              saveReview

            }

            style={({

              pressed,

            }) => [

              styles.saveButton,



              pressed &&

                !saving &&

                styles.saveButtonPressed,



              saving &&

                styles.saveButtonDisabled,

            ]}

          >

            {saving ? (

              <ActivityIndicator

                size="small"

                color={

                  colors.background

                }

              />

            ) : (

              <Text

                style={

                  styles.saveButtonText

                }

              >

                Save

              </Text>

            )}

          </Pressable>



          <Text

            style={

              styles.bottomNote

            }

          >

            You can change your

            rating or review later.

          </Text>

        </KeyboardAwareScrollView>

      </View>

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



    keyboardView: {

      flex: 1,

    },



    header: {

      height: 56,

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

      width: 42,

      height: 42,

      borderRadius: 21,

      alignItems:

        'center',

      justifyContent:

        'center',

    },



    headerTitle: {

      flex: 1,

      color:

        colors.text,

      fontFamily:

        'PlayfairDisplay_700Bold',

      fontSize: 20,

      textAlign:

        'center',

    },



    headerSpacer: {

      width: 42,

    },



    scrollView: {

      flex: 1,

    },



    content: {

      width: '100%',

      maxWidth: 720,

      alignSelf:

        'center',

      paddingHorizontal:

        20,

      paddingTop: 28,

      paddingBottom:

        50,

    },



    loadingContainer: {

      flex: 1,

      alignItems:

        'center',

      justifyContent:

        'center',

    },



    loadingText: {

      color:

        colors.secondaryText,

      fontFamily:

        'Inter_400Regular',

      fontSize: 13,

      marginTop: 12,

    },



    bookSection: {

      alignItems:

        'center',

    },



    bookTitle: {

      color:

        colors.text,

      fontFamily:

        'PlayfairDisplay_700Bold',

      fontSize: 27,

      lineHeight: 34,

      textAlign:

        'center',

    },



    author: {

      color:

        colors.secondaryText,

      fontFamily:

        'Inter_400Regular',

      fontSize: 14,

      textAlign:

        'center',

      marginTop: 7,

    },



    statusBadge: {

      backgroundColor:

        colors.elevated,

      borderWidth: 1,

      borderColor:

        colors.border,

      paddingHorizontal:

        11,

      paddingVertical: 5,

      borderRadius: 999,

      marginTop: 14,

    },



    statusText: {

      color:

        colors.gold,

      fontFamily:

        'Inter_700Bold',

      fontSize: 10,

      letterSpacing: 1,

    },



    dnfBadge: {

      borderColor:

        colors.danger,

    },



    dnfStatusText: {

      color:

        colors.danger,

    },



    divider: {

      height: 1,

      backgroundColor:

        colors.border,

      marginVertical:

        28,

    },



    ratingSection: {

      alignItems:

        'center',

    },



    sectionLabel: {

      color:

        colors.mutedText,

      fontFamily:

        'Inter_700Bold',

      fontSize: 10,

      letterSpacing: 1.4,

    },



    ratingHeading: {

      color:

        colors.text,

      fontFamily:

        'PlayfairDisplay_600SemiBold',

      fontSize: 23,

      marginTop: 9,

    },



    starsRow: {

      flexDirection:

        'row',

      justifyContent:

        'center',

      alignItems:

        'center',

      marginTop: 18,

    },



    starContainer: {

      width: 44,

      height: 44,

      alignItems:

        'center',

      justifyContent:

        'center',

      position:

        'relative',

    },



    leftHalf: {

      position:

        'absolute',

      left: 0,

      top: 0,

      bottom: 0,

      width: '50%',

    },



    rightHalf: {

      position:

        'absolute',

      right: 0,

      top: 0,

      bottom: 0,

      width: '50%',

    },



    ratingHint: {

      color:

        colors.mutedText,

      fontFamily:

        'Inter_400Regular',

      fontSize: 11,

      textAlign:

        'center',

      marginTop: 8,

    },



    clearRatingButton: {

      marginTop: 12,

      paddingVertical: 7,

      paddingHorizontal:

        12,

    },



    clearRatingText: {

      color:

        colors.secondaryText,

      fontFamily:

        'Inter_500Medium',

      fontSize: 12,

    },



    reviewSection: {

      marginTop: 38,

    },



    reviewHeading: {

      color:

        colors.text,

      fontFamily:

        'PlayfairDisplay_600SemiBold',

      fontSize: 24,

      marginTop: 8,

    },



    reviewSubheading: {

      color:

        colors.secondaryText,

      fontFamily:

        'Inter_400Regular',

      fontSize: 13,

      lineHeight: 20,

      marginTop: 7,

    },



    reviewInput: {

      minHeight: 170,

      backgroundColor:

        colors.surface,

      borderWidth: 1,

      borderColor:

        colors.border,

      borderRadius: 16,

      color:

        colors.text,

      fontFamily:

        'Inter_400Regular',

      fontSize: 15,

      lineHeight: 22,

      padding: 16,

      marginTop: 16,

    },



    characterRow: {

      flexDirection:

        'row',

      justifyContent:

        'space-between',

      alignItems:

        'center',

      marginTop: 7,

      paddingHorizontal: 2,

    },



    optionalText: {

      color:

        colors.mutedText,

      fontFamily:

        'Inter_400Regular',

      fontSize: 11,

    },



    characterCount: {

      color:

        colors.mutedText,

      fontFamily:

        'Inter_400Regular',

      fontSize: 11,

    },



    saveButton: {

      height: 52,

      backgroundColor:

        colors.gold,

      borderRadius: 14,

      alignItems:

        'center',

      justifyContent:

        'center',

      marginTop: 32,

    },



    saveButtonPressed: {

      backgroundColor:

        colors.goldPressed,

    },



    saveButtonDisabled: {

      opacity: 0.55,

    },



    saveButtonText: {

      color:

        colors.background,

      fontFamily:

        'Inter_700Bold',

      fontSize: 15,

    },



    bottomNote: {

      color:

        colors.mutedText,

      fontFamily:

        'Inter_400Regular',

      fontSize: 11,

      textAlign:

        'center',

      marginTop: 12,

    },



    savedContainer: {

      flex: 1,

      width: '100%',

      maxWidth: 560,

      alignSelf: 'center',

      alignItems: 'center',

      justifyContent: 'center',

      paddingHorizontal: 24,

      paddingBottom: 44,

    },



    savedIcon: {

      width: 66,

      height: 66,

      borderRadius: 33,

      alignItems: 'center',

      justifyContent: 'center',

      backgroundColor: colors.gold,

      marginBottom: 20,

    },



    savedEyebrow: {

      color: colors.gold,

      fontFamily: 'Inter_700Bold',

      fontSize: 10.5,

      letterSpacing: 1.5,

      textAlign: 'center',

      marginBottom: 9,

    },



    savedTitle: {

      color: colors.text,

      fontFamily: 'PlayfairDisplay_700Bold',

      fontSize: 29,

      lineHeight: 36,

      textAlign: 'center',

    },



    savedText: {

      color: colors.secondaryText,

      fontFamily: 'Inter_400Regular',

      fontSize: 13,

      lineHeight: 20,

      textAlign: 'center',

      maxWidth: 430,

      marginTop: 10,

    },



    shareButton: {

      width: '100%',

      maxWidth: 420,

      height: 52,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'center',

      gap: 8,

      backgroundColor: colors.gold,

      borderRadius: 14,

      marginTop: 28,

    },



    shareButtonText: {

      color: colors.background,

      fontFamily: 'Inter_700Bold',

      fontSize: 15,

    },



    notNowButton: {

      minHeight: 44,

      alignItems: 'center',

      justifyContent: 'center',

      paddingHorizontal: 18,

      marginTop: 8,

    },



    notNowText: {

      color: colors.secondaryText,

      fontFamily: 'Inter_600SemiBold',

      fontSize: 13,

    },



    pressed: {

      opacity: 0.65,

    },

  });

}