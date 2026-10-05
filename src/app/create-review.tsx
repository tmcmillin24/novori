import { moderationMediaUrl } from '../lib/moderation-media-url';
import BookCoverImage from '../components/BookCoverImage';
import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
  ClubWithMembership,
  getMyClubs,
} from '../lib/clubs';
import {
  createPost,
} from '../lib/feed';
import {
  supabase,
} from '../lib/supabase';
import {
  getUserBooks,
  updateBookReview,
  UserBook,
} from '../lib/user-books';

type ViewerProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Destination =
  | {
      type: 'library';
      clubId: null;
    }
  | {
      type: 'feed';
      clubId: null;
    }
  | {
      type: 'club';
      clubId: string;
    };

function formatFinishedDate(
  value: string | null
) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        'short',
      day:
        'numeric',
      year:
        'numeric',
    }
  );
}

export default function CreateReviewScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      bookId?: string;
      rating?: string;
      review?: string;
    }>();

  const requestedBookId =
    typeof params.bookId ===
    'string'
      ? params.bookId.trim()
      : '';

  const requestedRating =
    typeof params.rating ===
    'string'
      ? Number(params.rating)
      : NaN;

  const requestedReview =
    typeof params.review ===
    'string'
      ? params.review
      : '';

  const {
    width,
  } =
    useWindowDimensions();

  const {
    colors,
  } =
    useNovoriTheme();

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

  const tablet =
    width >=
    768;

  const [
    books,
    setBooks,
  ] =
    useState<UserBook[]>(
      []
    );

  const [
    clubs,
    setClubs,
  ] =
    useState<ClubWithMembership[]>(
      []
    );

  const [
    viewerProfile,
    setViewerProfile,
  ] =
    useState<ViewerProfile | null>(
      null
    );


  const [
    selectedBookId,
    setSelectedBookId,
  ] =
    useState<string | null>(
      null
    );

  const [
    rating,
    setRating,
  ] =
    useState<number>(
      0
    );

  const [
    review,
    setReview,
  ] =
    useState('');

  const [
    destination,
    setDestination,
  ] =
    useState<Destination>({
      type:
        'library',
      clubId:
        null,
    });

  const [
    clubsExpanded,
    setClubsExpanded,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(
      null
    );

  const [
    publishing,
    setPublishing,
  ] =
    useState(false);

  const selectedBook =
    useMemo(
      () =>
        books.find(
          (
            book
          ) =>
            book.google_book_id ===
            selectedBookId
        ) ??
        null,
      [
        books,
        selectedBookId,
      ]
    );

  const loadData =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );
          setLoadError(
            null
          );

          const [
            finishedBooks,
            myClubs,
            authResult,
          ] =
            await Promise.all([
              getUserBooks(
                'read'
              ),
              getMyClubs(),
              supabase.auth.getUser(),
            ]);

          const user =
            authResult.data.user;

          if (
            user
          ) {
            const {
              data:
                profileData,
            } =
              await supabase
                .from(
                  'profiles'
                )
                .select(
                  'display_name, username, avatar_url'
                )
                .eq(
                  'id',
                  user.id
                )
                .single();

            if (
              profileData
            ) {
              setViewerProfile(
                profileData
              );
            }
          }

          const sortedBooks =
            [...finishedBooks]
              .sort(
                (
                  a,
                  b
                ) => {
                  const aTime =
                    a.finished_at
                      ? new Date(
                          a.finished_at
                        ).getTime()
                      : 0;

                  const bTime =
                    b.finished_at
                      ? new Date(
                          b.finished_at
                        ).getTime()
                      : 0;

                  return (
                    bTime -
                    aTime
                  );
                }
              );

          setBooks(
            sortedBooks
          );
          setClubs(
            myClubs
          );

          const requestedBook =
            requestedBookId
              ? sortedBooks.find(
                  (
                    book
                  ) =>
                    book.google_book_id ===
                    requestedBookId
                ) ??
                null
              : null;

          const initialBook =
            requestedBook ??
            sortedBooks[0] ??
            null;

          setSelectedBookId(
            (
              current
            ) => {
              if (
                current &&
                sortedBooks.some(
                  (
                    book
                  ) =>
                    book.google_book_id ===
                    current
                )
              ) {
                return current;
              }

              return (
                initialBook
                  ?.google_book_id ??
                null
              );
            }
          );

          if (
            initialBook
          ) {
            setRating(
              Number.isFinite(
                requestedRating
              ) &&
              requestedRating >=
                0.5 &&
              requestedRating <=
                5
                ? requestedRating
                : initialBook.rating ??
                  0
            );

            setReview(
              requestedReview ||
              initialBook.review_text ||
              ''
            );
          }
        } catch (
          error
        ) {
          console.error(
            'Could not load review composer:',
            error
          );

          setLoadError(
            error instanceof
              Error
              ? error.message
              : 'Unable to load your finished books.'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        requestedBookId,
        requestedRating,
        requestedReview,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadData();
      },
      [
        loadData,
      ]
    )
  );

  function chooseBook(
    book:
      UserBook
  ) {
    setSelectedBookId(
      book.google_book_id
    );

    setRating(
      book.rating ??
      0
    );

    setReview(
      book.review_text ??
      ''
    );
  }

  function setHalfStarRating(
    starIndex:
      number,
    half:
      boolean
  ) {
    const nextRating =
      starIndex -
      (
        half
          ? 0.5
          : 0
      );

    setRating(
      nextRating
    );
  }

  const trimmedReview =
    review.trim();

  const canSave =
    Boolean(
      selectedBook
    ) &&
    rating >=
      0.5 &&
    rating <=
      5 &&
    trimmedReview.length >=
      1 &&
    trimmedReview.length <=
      4000 &&
    !publishing;

  async function saveReview() {
    if (
      !selectedBook ||
      !canSave
    ) {
      return;
    }

    try {
      setPublishing(
        true
      );

      await updateBookReview({
        googleBookId:
          selectedBook.google_book_id,
        rating,
        reviewText:
          trimmedReview,
      });

      if (
        destination.type ===
        'feed'
      ) {
        await createPost({
          body:
            trimmedReview,
          clubId:
            null,
          postType:
            'review',
          googleBookId:
            selectedBook.google_book_id,
          bookTitle:
            selectedBook.title,
          bookCoverUrl:
            selectedBook.cover_url,
          rating,
        });
      }

      if (
        destination.type ===
        'club'
      ) {
        await createPost({
          body:
            trimmedReview,
          clubId:
            destination.clubId,
          postType:
            'review',
          googleBookId:
            selectedBook.google_book_id,
          bookTitle:
            selectedBook.title,
          bookCoverUrl:
            selectedBook.cover_url,
          rating,
        });
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
        destination.type ===
        'library'
          ? 'Could not save review'
          : 'Could not share review',
        error instanceof
          Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setPublishing(
        false
      );
    }
  }

  if (
    loading
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
            styles.centered
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
            Loading your finished books…
          </Text>
        </View>
      </SafeAreaView>
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
            hitSlop={
              10
            }
            style={({
              pressed,
            }) => [
              styles.headerButton,
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
            Review a Book
          </Text>

          <Pressable
            disabled={
              !canSave
            }
            onPress={
              saveReview
            }
            style={({
              pressed,
            }) => [
              styles.publishButton,
              !canSave &&
                styles.publishButtonDisabled,
              pressed &&
                canSave &&
                styles.pressed,
            ]}
          >
            {publishing ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.gold
                }
              />
            ) : (
              <Text
                style={
                  styles.publishText
                }
              >
                {destination.type ===
                'library'
                  ? 'Save'
                  : 'Share'}
              </Text>
            )}
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          style={
            styles.scroll
          }
          contentContainerStyle={[
            styles.content,
            tablet &&
              styles.contentTablet,
          ]}
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
              styles.intro
            }
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              REVIEW A BOOK
            </Text>

            <Text
              style={
                styles.title
              }
            >
              Share your take
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Choose a finished book, rate it, and write the review you want other readers to find.
            </Text>
          </View>

          {loadError ? (
            <View
              style={
                styles.errorCard
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={
                  20
                }
                color={
                  colors.danger
                }
              />

              <Text
                style={
                  styles.errorText
                }
              >
                {loadError}
              </Text>
            </View>
          ) : null}

          {books.length ===
          0 ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Ionicons
                  name="book-outline"
                  size={
                    24
                  }
                  color={
                    colors.gold
                  }
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No finished books yet
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Mark a book as Read in your Library before publishing a review.
              </Text>

              <Pressable
                onPress={() =>
                  router.push(
                    '/(tabs)/library'
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.primaryButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Open Library
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text
                style={
                  styles.sectionLabel
                }
              >
                CHOOSE A BOOK
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.bookRow
                }
              >
                {books.map(
                  (
                    book
                  ) => {
                    const selected =
                      book.google_book_id ===
                      selectedBookId;

                    return (
                      <Pressable
                        key={
                          book.id
                        }
                        onPress={() =>
                          chooseBook(
                            book
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.bookCard,
                          selected &&
                            styles.bookCardSelected,
                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        {(book.google_book_id || book.cover_url) ? (
                          <BookCoverImage
                            googleBookId={book.google_book_id}
                            existingCoverUrl={book.cover_url}
                            style={
                              styles.bookCover
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.bookCoverFallback
                            }
                          >
                            <Ionicons
                              name="book-outline"
                              size={
                                24
                              }
                              color={
                                colors.gold
                              }
                            />
                          </View>
                        )}

                        <Text
                          style={
                            styles.bookTitle
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {book.title}
                        </Text>

                        <Text
                          style={
                            styles.bookAuthor
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {book.authors?.join(
                            ', '
                          ) ||
                            'Unknown author'}
                        </Text>

                        {book.finished_at ? (
                          <Text
                            style={
                              styles.finishedText
                            }
                            numberOfLines={
                              1
                            }
                          >
                            Finished{' '}
                            {
                              formatFinishedDate(
                                book.finished_at
                              )
                            }
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  }
                )}
              </ScrollView>

              {selectedBook ? (
                <>
                  <View
                    style={
                      styles.selectedBookCard
                    }
                  >
                    {(selectedBook.google_book_id || selectedBook.cover_url) ? (
                      <BookCoverImage
                        googleBookId={selectedBook.google_book_id}
                        existingCoverUrl={selectedBook.cover_url}
                        style={
                          styles.selectedCover
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.selectedCoverFallback
                        }
                      >
                        <Ionicons
                          name="book-outline"
                          size={
                            28
                          }
                          color={
                            colors.gold
                          }
                        />
                      </View>
                    )}

                    <View
                      style={
                        styles.selectedCopy
                      }
                    >
                      <Text
                        style={
                          styles.selectedEyebrow
                        }
                      >
                        REVIEWING
                      </Text>

                      <Text
                        style={
                          styles.selectedTitle
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {selectedBook.title}
                      </Text>

                      <Text
                        style={
                          styles.selectedAuthor
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {selectedBook.authors?.join(
                          ', '
                        ) ||
                          'Unknown author'}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.sectionLabel
                    }
                  >
                    YOUR RATING
                  </Text>

                  <View
                    style={
                      styles.ratingCard
                    }
                  >
                    <View
                      style={
                        styles.starRow
                      }
                    >
                      {[1, 2, 3, 4, 5].map(
                        (
                          star
                        ) => {
                          const filled =
                            rating >=
                            star;

                          const halfFilled =
                            !filled &&
                            rating >=
                              star -
                                0.5;

                          return (
                            <View
                              key={
                                star
                              }
                              style={
                                styles.starHit
                              }
                            >
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${star - 0.5} stars`}
                                onPress={() =>
                                  setHalfStarRating(
                                    star,
                                    true
                                  )
                                }
                                style={
                                  styles.leftHalf
                                }
                              />

                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${star} stars`}
                                onPress={() =>
                                  setHalfStarRating(
                                    star,
                                    false
                                  )
                                }
                                style={
                                  styles.rightHalf
                                }
                              />

                              <Ionicons
                                pointerEvents="none"
                                name={
                                  filled
                                    ? 'star'
                                    : halfFilled
                                    ? 'star-half'
                                    : 'star-outline'
                                }
                                size={
                                  32
                                }
                                color={
                                  colors.gold
                                }
                              />
                            </View>
                          );
                        }
                      )}
                    </View>

                    <Text
                      style={
                        styles.ratingText
                      }
                    >
                      {rating >
                      0
                        ? `${rating.toFixed(
                            1
                          )} / 5`
                        : 'Tap a star to rate'}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.sectionLabel
                    }
                  >
                    YOUR REVIEW
                  </Text>

                  <View
                    style={
                      styles.reviewCard
                    }
                  >
                    <TextInput
                      value={
                        review
                      }
                      onChangeText={
                        setReview
                      }
                      maxLength={
                        4000
                      }
                      multiline
                      textAlignVertical="top"
                      placeholder="What did you think? What should another reader know?"
                      placeholderTextColor={
                        colors.mutedText
                      }
                      style={
                        styles.reviewInput
                      }
                    />

                    <Text
                      style={
                        styles.counter
                      }
                    >
                      {review.length}/4000
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.sectionLabel
                    }
                  >
                    SAVE OR SHARE
                  </Text>

                  <View
                    style={
                      styles.destinationCard
                    }
                  >
                    <Pressable
                      onPress={() =>
                        setDestination({
                          type:
                            'library',
                          clubId:
                            null,
                        })
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.destinationRow,
                        destination.type ===
                          'library' &&
                          styles.destinationRowSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <View
                        style={
                          styles.destinationIcon
                        }
                      >
                        <Ionicons
                          name="bookmark-outline"
                          size={
                            20
                          }
                          color={
                            colors.gold
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.destinationCopy
                        }
                      >
                        <Text
                          style={
                            styles.destinationTitle
                          }
                        >
                          Save to Library only
                        </Text>

                        <Text
                          style={
                            styles.destinationText
                          }
                        >
                          Keep the rating and review attached to this book without creating a social post.
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          destination.type ===
                          'library'
                            ? 'radio-button-on'
                            : 'radio-button-off'
                        }
                        size={
                          20
                        }
                        color={
                          destination.type ===
                          'library'
                            ? colors.gold
                            : colors.mutedText
                        }
                      />
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        setDestination({
                          type:
                            'feed',
                          clubId:
                            null,
                        })
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.destinationRow,
                        destination.type ===
                          'feed' &&
                          styles.destinationRowSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      {viewerProfile?.avatar_url ? (
                        <Image
                          source={{
                            uri:
                              moderationMediaUrl(viewerProfile.avatar_url),
                          }}
                          style={
                            styles.profileDestinationAvatar
                          }
                        />
                      ) : (
                        <View
                          style={
                            styles.profileDestinationFallback
                          }
                        >
                          <Text
                            style={
                              styles.profileDestinationInitial
                            }
                          >
                            {(viewerProfile?.display_name?.trim() ||
                              viewerProfile?.username?.trim() ||
                              'N')
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View
                        style={
                          styles.destinationCopy
                        }
                      >
                        <Text
                          style={
                            styles.destinationTitle
                          }
                        >
                          Share to Feed
                        </Text>

                        <Text
                          style={
                            styles.destinationText
                          }
                        >
                          Save it to your Library and create a review post for your readers.
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          destination.type ===
                          'feed'
                            ? 'radio-button-on'
                            : 'radio-button-off'
                        }
                        size={
                          20
                        }
                        color={
                          destination.type ===
                          'feed'
                            ? colors.gold
                            : colors.mutedText
                        }
                      />
                    </Pressable>

                    {clubs.length ===
                    0 ? (
                      <View
                        style={[
                          styles.destinationRow,
                          styles.destinationRowDisabled,
                        ]}
                      >
                        <View
                          style={
                            styles.destinationIcon
                          }
                        >
                          <Ionicons
                            name="people-outline"
                            size={
                              20
                            }
                            color={
                              colors.mutedText
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.destinationCopy
                          }
                        >
                          <Text
                            style={
                              styles.destinationTitle
                            }
                          >
                            Share to Club
                          </Text>

                          <Text
                            style={
                              styles.destinationText
                            }
                          >
                            Join a club to share reviews there.
                          </Text>
                        </View>

                        <Ionicons
                          name="lock-closed-outline"
                          size={
                            18
                          }
                          color={
                            colors.mutedText
                          }
                        />
                      </View>
                    ) : clubs.length ===
                      1 ? (
                      <Pressable
                        onPress={() =>
                          setDestination({
                            type:
                              'club',
                            clubId:
                              clubs[0].id,
                          })
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.destinationRow,
                          destination.type ===
                            'club' &&
                            destination.clubId ===
                              clubs[0].id &&
                            styles.destinationRowSelected,
                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        {clubs[0].cover_url ? (
                          <Image
                            source={{
                              uri:
                                moderationMediaUrl(clubs[0].cover_url),
                            }}
                            style={
                              styles.destinationClubImage
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.destinationIcon
                            }
                          >
                            <Text
                              style={
                                styles.destinationClubInitial
                              }
                            >
                              {clubs[0].name
                                .charAt(
                                  0
                                )
                                .toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View
                          style={
                            styles.destinationCopy
                          }
                        >
                          <Text
                            style={
                              styles.destinationTitle
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {clubs[0].name}
                          </Text>

                          <Text
                            style={
                              styles.destinationText
                            }
                          >
                            Share directly with this club.
                          </Text>
                        </View>

                        <Ionicons
                          name={
                            destination.type ===
                              'club' &&
                            destination.clubId ===
                              clubs[0].id
                              ? 'radio-button-on'
                              : 'radio-button-off'
                          }
                          size={
                            20
                          }
                          color={
                            destination.type ===
                              'club' &&
                            destination.clubId ===
                              clubs[0].id
                              ? colors.gold
                              : colors.mutedText
                          }
                        />
                      </Pressable>
                    ) : (
                      <>
                        <Pressable
                          onPress={() =>
                            setClubsExpanded(
                              (
                                current
                              ) =>
                                !current
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.destinationRow,
                            destination.type ===
                              'club' &&
                              styles.destinationRowSelected,
                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          {destination.type ===
                          'club' &&
                          clubs.find(
                            (
                              club
                            ) =>
                              club.id ===
                              destination.clubId
                          )?.cover_url ? (
                            <Image
                              source={{
                                uri:
                                  moderationMediaUrl(clubs.find(
                                    (
                                      club
                                    ) =>
                                      club.id ===
                                      destination.clubId
                                  )?.cover_url ??
                                  ''),
                              }}
                              style={
                                styles.destinationClubImage
                              }
                            />
                          ) : (
                            <View
                              style={
                                styles.destinationIcon
                              }
                            >
                              <Ionicons
                                name="people-outline"
                                size={
                                  20
                                }
                                color={
                                  colors.gold
                                }
                              />
                            </View>
                          )}

                          <View
                            style={
                              styles.destinationCopy
                            }
                          >
                            <Text
                              style={
                                styles.destinationTitle
                              }
                            >
                              Share to Club
                            </Text>

                            <Text
                              style={
                                styles.destinationText
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {destination.type ===
                              'club'
                                ? clubs.find(
                                    (
                                      club
                                    ) =>
                                      club.id ===
                                      destination.clubId
                                  )
                                    ?.name ??
                                  'Choose a club'
                                : `${clubs.length} clubs available`}
                            </Text>
                          </View>

                          <Ionicons
                            name={
                              clubsExpanded
                                ? 'chevron-up'
                                : 'chevron-down'
                            }
                            size={
                              19
                            }
                            color={
                              colors.gold
                            }
                          />
                        </Pressable>

                        {clubsExpanded ? (
                          <View
                            style={
                              styles.clubDropdown
                            }
                          >
                            {clubs.map(
                              (
                                club
                              ) => {
                                const selected =
                                  destination.type ===
                                    'club' &&
                                  destination.clubId ===
                                    club.id;

                                return (
                                  <Pressable
                                    key={
                                      club.id
                                    }
                                    onPress={() => {
                                      setDestination({
                                        type:
                                          'club',
                                        clubId:
                                          club.id,
                                      });

                                      setClubsExpanded(
                                        false
                                      );
                                    }}
                                    style={({
                                      pressed,
                                    }) => [
                                      styles.clubDropdownRow,
                                      selected &&
                                        styles.clubDropdownRowSelected,
                                      pressed &&
                                        styles.pressed,
                                    ]}
                                  >
                                    {club.cover_url ? (
                                      <Image
                                        source={{
                                          uri:
                                            moderationMediaUrl(club.cover_url),
                                        }}
                                        style={
                                          styles.clubDropdownImage
                                        }
                                      />
                                    ) : (
                                      <View
                                        style={
                                          styles.clubDropdownIcon
                                        }
                                      >
                                        <Text
                                          style={
                                            styles.clubDropdownInitial
                                          }
                                        >
                                          {club.name
                                            .charAt(
                                              0
                                            )
                                            .toUpperCase()}
                                        </Text>
                                      </View>
                                    )}

                                    <Text
                                      style={[
                                        styles.clubDropdownName,
                                        selected &&
                                          styles.clubDropdownNameSelected,
                                      ]}
                                      numberOfLines={
                                        1
                                      }
                                    >
                                      {club.name}
                                    </Text>

                                    {selected ? (
                                      <Ionicons
                                        name="checkmark"
                                        size={
                                          18
                                        }
                                        color={
                                          colors.gold
                                        }
                                      />
                                    ) : null}
                                  </Pressable>
                                );
                              }
                            )}
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>

                  <View
                    style={
                      styles.saveNote
                    }
                  >
                    <Ionicons
                      name="bookmark-outline"
                      size={
                        16
                      }
                      color={
                        colors.mutedText
                      }
                    />

                    <Text
                      style={
                        styles.saveNoteText
                      }
                    >
                      Your rating and written review are always saved to the book in your Library. Sharing is optional.
                    </Text>
                  </View>
                </>
              ) : null}
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
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

    keyboardView: {
      flex:
        1,
    },

    scroll: {
      flex:
        1,
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
        22,
      paddingBottom:
        80,
    },

    contentTablet: {
      maxWidth:
        780,
      paddingHorizontal:
        30,
    },

    centered: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding:
        24,
    },

    loadingText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      marginTop:
        12,
    },

    header: {
      height:
        56,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        10,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
    },

    headerButton: {
      width:
        44,
      height:
        44,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
    },

    publishButton: {
      minWidth:
        64,
      minHeight:
        42,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        8,
    },

    publishButtonDisabled: {
      opacity:
        0.38,
    },

    publishText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
    },

    intro: {
      marginBottom:
        22,
    },

    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10.5,
      letterSpacing:
        1.6,
      marginBottom:
        7,
    },

    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        32,
      lineHeight:
        38,
    },

    subtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        20,
      marginTop:
        7,
      maxWidth:
        620,
    },

    sectionLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10.5,
      letterSpacing:
        1.25,
      marginTop:
        22,
      marginBottom:
        9,
    },

    errorCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        10,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        14,
      backgroundColor:
        colors.surface,
      padding:
        14,
      marginBottom:
        16,
    },

    errorText: {
      flex:
        1,
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        17,
    },

    emptyCard: {
      borderWidth:
        1,
      borderColor:
        colors.gold,
      borderRadius:
        18,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      padding:
        24,
      marginTop:
        12,
    },

    emptyIcon: {
      width:
        48,
      height:
        48,
      borderRadius:
        16,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.gold,
      marginBottom:
        14,
    },

    emptyTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
      textAlign:
        'center',
    },

    emptyText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      textAlign:
        'center',
      marginTop:
        7,
      maxWidth:
        380,
    },

    primaryButton: {
      minHeight:
        44,
      borderRadius:
        22,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.gold,
      paddingHorizontal:
        18,
      marginTop:
        18,
    },

    primaryButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
    },

    bookRow: {
      gap:
        12,
      paddingRight:
        8,
    },

    bookCard: {
      width:
        132,
      borderRadius:
        16,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      padding:
        10,
    },

    bookCardSelected: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },

    bookCover: {
      width:
        110,
      height:
        164,
      borderRadius:
        10,
      backgroundColor:
        colors.elevated,
      alignSelf:
        'center',
    },

    bookCoverFallback: {
      width:
        110,
      height:
        164,
      borderRadius:
        10,
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
      alignSelf:
        'center',
    },

    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
      lineHeight:
        16,
      marginTop:
        9,
    },

    bookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        3,
    },

    finishedText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        9.5,
      marginTop:
        6,
    },

    selectedBookCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.gold,
      borderRadius:
        18,
      backgroundColor:
        colors.surface,
      padding:
        14,
      marginTop:
        20,
    },

    selectedCover: {
      width:
        72,
      height:
        106,
      borderRadius:
        9,
      backgroundColor:
        colors.elevated,
    },

    selectedCoverFallback: {
      width:
        72,
      height:
        106,
      borderRadius:
        9,
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

    selectedCopy: {
      flex:
        1,
      marginLeft:
        14,
    },

    selectedEyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9.5,
      letterSpacing:
        1.2,
      marginBottom:
        5,
    },

    selectedTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        19,
      lineHeight:
        24,
    },

    selectedAuthor: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        17,
      marginTop:
        4,
    },

    ratingCard: {
      alignItems:
        'center',
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      paddingVertical:
        18,
      paddingHorizontal:
        14,
    },

    starRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        5,
    },

    starHit: {
      width:
        38,
      height:
        38,
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
      left:
        0,
      top:
        0,
      bottom:
        0,
      width:
        '50%',
      zIndex:
        2,
    },

    rightHalf: {
      position:
        'absolute',
      right:
        0,
      top:
        0,
      bottom:
        0,
      width:
        '50%',
      zIndex:
        2,
    },

    ratingText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
      marginTop:
        8,
    },

    reviewCard: {
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      paddingHorizontal:
        14,
      paddingTop:
        12,
      paddingBottom:
        8,
    },

    reviewInput: {
      minHeight:
        170,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      lineHeight:
        21,
    },

    counter: {
      alignSelf:
        'flex-end',
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        8,
    },

    destinationCard: {
      overflow:
        'hidden',
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },

    destinationRow: {
      minHeight:
        70,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      paddingVertical:
        10,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },

    destinationRowSelected: {
      backgroundColor:
        colors.elevated,
    },

    destinationRowDisabled: {
      opacity:
        0.64,
    },

    clubDropdown: {
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
      backgroundColor:
        colors.background,
      paddingVertical:
        5,
    },

    clubDropdownRow: {
      minHeight:
        52,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        16,
      paddingVertical:
        8,
      marginHorizontal:
        7,
      borderRadius:
        12,
    },

    clubDropdownRowSelected: {
      backgroundColor:
        colors.elevated,
    },

    clubDropdownIcon: {
      width:
        30,
      height:
        30,
      borderRadius:
        10,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      marginRight:
        10,
    },

    clubDropdownImage: {
      width:
        30,
      height:
        30,
      borderRadius:
        10,
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      marginRight:
        10,
    },

    clubDropdownInitial: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12,
    },

    clubDropdownName: {
      flex:
        1,
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        12.5,
    },

    clubDropdownNameSelected: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
    },

    profileDestinationAvatar: {
      width:
        40,
      height:
        40,
      borderRadius:
        20,
      backgroundColor:
        colors.elevated,
      marginRight:
        12,
    },

    profileDestinationFallback: {
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
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      marginRight:
        12,
    },

    profileDestinationInitial: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        16,
    },

    destinationIcon: {
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
        colors.background,
      borderWidth:
        1,
      borderColor:
        colors.gold,
      marginRight:
        12,
    },

    destinationClubImage: {
      width:
        40,
      height:
        40,
      borderRadius:
        13,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.gold,
      marginRight:
        12,
    },

    destinationClubInitial: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        15,
    },

    destinationCopy: {
      flex:
        1,
      paddingRight:
        12,
    },

    destinationTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },

    destinationText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
      marginTop:
        3,
    },

    saveNote: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap:
        8,
      marginTop:
        16,
      paddingHorizontal:
        4,
    },

    saveNoteText: {
      flex:
        1,
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        16,
    },

    pressed: {
      opacity:
        0.68,
    },
  });
}
