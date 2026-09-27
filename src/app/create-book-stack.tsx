import { Ionicons } from '@expo/vector-icons';
import {
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import BookStackVisual from '../components/BookStackVisual';
import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';
import {
  getBestSearchCover,
  GoogleBookSearchItem,
  searchNovoriBooks,
} from '../lib/book-search';
import {
  BookStackDraftItem,
  createBookStack,
} from '../lib/book-stacks';
import {
  createPost,
} from '../lib/feed';

const MAX_STACK_BOOKS = 10;
const MIN_STACK_BOOKS = 2;

export default function CreateBookStackScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    name,
    setName,
  ] =
    useState('');

  const [
    items,
    setItems,
  ] =
    useState<
      BookStackDraftItem[]
    >([]);

  const [
    searchOpen,
    setSearchOpen,
  ] =
    useState(false);

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    results,
    setResults,
  ] =
    useState<
      GoogleBookSearchItem[]
    >([]);

  const [
    searching,
    setSearching,
  ] =
    useState(false);

  const [
    searchError,
    setSearchError,
  ] =
    useState('');

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    previewing,
    setPreviewing,
  ] =
    useState(false);

  const [
    postText,
    setPostText,
  ] =
    useState('');

  const [
    publishing,
    setPublishing,
  ] =
    useState(false);

  const timerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const requestRef =
    useRef(0);

  useEffect(() => {
    if (
      timerRef.current
    ) {
      clearTimeout(
        timerRef.current
      );
    }

    const searchTerm =
      query.trim();

    if (
      !searchOpen ||
      searchTerm.length <
        2
    ) {
      requestRef.current +=
        1;
      setResults([]);
      setSearchError('');
      setSearching(false);
      return;
    }

    const requestId =
      ++requestRef.current;

    timerRef.current =
      setTimeout(() => {
        void performSearch(
          searchTerm,
          requestId
        );
      }, 350);

    return () => {
      if (
        timerRef.current
      ) {
        clearTimeout(
          timerRef.current
        );
      }
    };
  }, [
    query,
    searchOpen,
  ]);

  async function performSearch(
    searchTerm: string,
    requestId: number
  ) {
    try {
      setSearching(true);
      setSearchError('');

      const next =
        await searchNovoriBooks(
          searchTerm
        );

      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      setResults(
        next
      );
    } catch (
      error
    ) {
      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      console.error(
        'Could not search books for stack:',
        error
      );

      setSearchError(
        'Could not search books. Please try again.'
      );

      setResults([]);
    } finally {
      if (
        requestId ===
        requestRef.current
      ) {
        setSearching(false);
      }
    }
  }

  function isAdded(
    googleBookId: string
  ) {
    return items.some(
      (item) =>
        item.googleBookId ===
        googleBookId
    );
  }

  function addBook(
    book:
      GoogleBookSearchItem
  ) {
    if (
      items.length >=
      MAX_STACK_BOOKS
    ) {
      Alert.alert(
        'Stack is full',
        'Book Stacks can contain up to 10 books.'
      );
      return;
    }

    if (
      isAdded(
        book.id
      )
    ) {
      return;
    }

    const next:
      BookStackDraftItem = {
        googleBookId:
          book.id,
        title:
          book.volumeInfo.title
            ?.trim() ||
          'Untitled',
        authors:
          book.volumeInfo.authors ??
          [],
        coverUrl:
          getBestSearchCover(
            book.volumeInfo.imageLinks
          ) ?? null,
      };

    setItems(
      (
        current
      ) => [
        ...current,
        next,
      ]
    );
  }

  function removeBook(
    index: number
  ) {
    setItems(
      (
        current
      ) =>
        current.filter(
          (
            _,
            itemIndex
          ) =>
            itemIndex !==
            index
        )
    );
  }

  function moveBook(
    index: number,
    direction:
      -1 | 1
  ) {
    const target =
      index +
      direction;

    if (
      target < 0 ||
      target >=
        items.length
    ) {
      return;
    }

    setItems(
      (
        current
      ) => {
        const next = [
          ...current,
        ];

        const [
          moved,
        ] =
          next.splice(
            index,
            1
          );

        next.splice(
          target,
          0,
          moved
        );

        return next;
      }
    );
  }

  function validateStack() {
    const cleanName =
      name.trim();

    if (
      !cleanName
    ) {
      Alert.alert(
        'Name your stack',
        'Give this Book Stack a name before saving it.'
      );
      return false;
    }

    if (
      items.length <
      MIN_STACK_BOOKS
    ) {
      Alert.alert(
        'Add more books',
        'A Book Stack needs at least 2 books.'
      );
      return false;
    }

    return true;
  }

  async function saveStack(
    openPreview:
      boolean
  ) {
    if (
      saving ||
      !validateStack()
    ) {
      return;
    }

    if (
      openPreview
    ) {
      setPreviewing(
        true
      );
      return;
    }

    try {
      setSaving(true);

      await createBookStack(
        name,
        items
      );

      router.replace(
        '/(tabs)/profile'
      );
    } catch (
      error
    ) {
      console.error(
        'Could not save Book Stack:',
        error
      );

      Alert.alert(
        'Could not save stack',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishStack() {
    if (
      publishing ||
      !validateStack()
    ) {
      return;
    }

    try {
      setPublishing(
        true
      );

      const stack =
        await createBookStack(
          name,
          items
        );

      await createPost({
        body:
          postText.trim() ||
          stack.name,
        postType:
          'book_stack',
        bookStackId:
          stack.id,
      });

      router.replace(
        '/(tabs)'
      );
    } catch (
      error
    ) {
      console.error(
        'Could not publish Book Stack:',
        error
      );

      Alert.alert(
        'Could not publish stack',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setPublishing(
        false
      );
    }
  }

  const visualItems =
    items.map(
      (
        item,
        index
      ) => ({
        id:
          item.googleBookId,
        stack_id:
          'draft',
        google_book_id:
          item.googleBookId,
        title:
          item.title,
        authors:
          item.authors,
        cover_url:
          item.coverUrl,
        position:
          index,
        created_at:
          '',
      })
    );

  if (
    previewing
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={() =>
              setPreviewing(
                false
              )
            }
            hitSlop={10}
            style={
              styles.headerButton
            }
          >
            <Ionicons
              name="chevron-back"
              size={24}
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
            Preview
          </Text>

          <View
            style={
              styles.headerButton
            }
          />
        </View>

        <ScrollView
          contentContainerStyle={
            styles.previewContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.previewEyebrowRow
            }
          >
            <View
              style={
                styles.previewAccent
              }
            />

            <Ionicons
              name="albums-outline"
              size={14}
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.previewEyebrow
              }
            >
              BOOK STACK
            </Text>
          </View>

          <Text
            style={
              styles.previewName
            }
          >
            {
              name.trim()
            }
          </Text>

          <TextInput
            value={
              postText
            }
            onChangeText={
              setPostText
            }
            placeholder="Say something about this stack…"
            placeholderTextColor={
              colors.mutedText
            }
            multiline
            maxLength={4000}
            style={
              styles.postInput
            }
          />

          <View
            style={
              styles.previewVisual
            }
          >
            <BookStackVisual
              items={
                visualItems
              }
            />
          </View>

          <View
            style={
              styles.previewMeta
            }
          >
            <Text
              style={
                styles.previewMetaText
              }
            >
              {
                items.length
              }{' '}
              {
                items.length ===
                1
                  ? 'book'
                  : 'books'
              }
            </Text>

            <Text
              style={
                styles.previewMetaDot
              }
            >
              ·
            </Text>

            <Text
              style={
                styles.previewMetaText
              }
            >
              Will save to your profile
            </Text>
          </View>

          <View
            style={
              styles.previewHint
            }
          >
            <Ionicons
              name="eye-outline"
              size={17}
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.previewHintText
              }
            >
              This is how your Book Stack will be introduced in the feed.
            </Text>
          </View>
        </ScrollView>

        <View
          style={
            styles.previewFooter
          }
        >
          <Pressable
            disabled={
              publishing
            }
            onPress={() =>
              void publishStack()
            }
            style={({ pressed }) => [
              styles.publishButton,
              pressed &&
                styles.pressed,
              publishing &&
                styles.disabled,
            ]}
          >
            {publishing ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.background
                }
              />
            ) : (
              <>
                <Text
                  style={
                    styles.publishButtonText
                  }
                >
                  Publish
                </Text>

                <Ionicons
                  name="arrow-up-circle"
                  size={19}
                  color={
                    colors.background
                  }
                />
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
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
          hitSlop={10}
          style={
            styles.headerButton
          }
        >
          <Ionicons
            name="close"
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
          Book Stack
        </Text>

        <View
          style={
            styles.headerButton
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
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
            BUILD A STACK
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Put your books together your way.
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Pick 2–10 books, arrange the order, then save it to your profile or turn it into a post.
          </Text>
        </View>

        <View
          style={
            styles.nameSection
          }
        >
          <Text
            style={
              styles.sectionLabel
            }
          >
            STACK NAME
          </Text>

          <TextInput
            value={
              name
            }
            onChangeText={
              setName
            }
            placeholder="e.g. Books I'd read again for the first time"
            placeholderTextColor={
              colors.mutedText
            }
            maxLength={80}
            style={
              styles.nameInput
            }
          />

          <Text
            style={
              styles.characterCount
            }
          >
            {name.length}/80
          </Text>
        </View>

        <View
          style={
            styles.visualSection
          }
        >
          <View
            style={
              styles.sectionHeaderRow
            }
          >
            <View>
              <Text
                style={
                  styles.sectionLabel
                }
              >
                YOUR STACK
              </Text>

              <Text
                style={
                  styles.sectionSubtext
                }
              >
                First book is the featured cover.
              </Text>
            </View>

            <Text
              style={
                styles.bookCount
              }
            >
              {items.length}/
              {MAX_STACK_BOOKS}
            </Text>
          </View>

          {items.length >
          0 ? (
            <View
              style={
                styles.stackPreview
              }
            >
              <BookStackVisual
                items={
                  visualItems
                }
              />
            </View>
          ) : (
            <Pressable
              onPress={() =>
                setSearchOpen(
                  true
                )
              }
              style={({ pressed }) => [
                styles.emptyStack,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.emptyStackIcon
                }
              >
                <Ionicons
                  name="albums-outline"
                  size={31}
                  color={
                    colors.gold
                  }
                />
              </View>

              <Text
                style={
                  styles.emptyStackTitle
                }
              >
                Start with a book
              </Text>

              <Text
                style={
                  styles.emptyStackText
                }
              >
                Your covers will overlap here as the stack grows.
              </Text>
            </Pressable>
          )}

          <Pressable
            disabled={
              items.length >=
              MAX_STACK_BOOKS
            }
            onPress={() =>
              setSearchOpen(
                true
              )
            }
            style={({ pressed }) => [
              styles.addBookButton,
              items.length >=
                MAX_STACK_BOOKS &&
                styles.disabled,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={18}
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.addBookText
              }
            >
              Add Books
            </Text>
          </Pressable>
        </View>

        {items.length >
        0 ? (
          <View
            style={
              styles.arrangeSection
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              ARRANGE
            </Text>

            <Text
              style={
                styles.sectionSubtext
              }
            >
              Move books up or down to set the stack order.
            </Text>

            <View
              style={
                styles.arrangeList
              }
            >
              {items.map(
                (
                  item,
                  index
                ) => (
                  <View
                    key={
                      item.googleBookId
                    }
                    style={
                      styles.arrangeRow
                    }
                  >
                    {item.coverUrl ? (
                      <Image
                        source={{
                          uri:
                            item.coverUrl,
                        }}
                        style={
                          styles.arrangeCover
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.arrangeCoverFallback
                        }
                      >
                        <Ionicons
                          name="book-outline"
                          size={18}
                          color={
                            colors.gold
                          }
                        />
                      </View>
                    )}

                    <View
                      style={
                        styles.arrangeCopy
                      }
                    >
                      <Text
                        style={
                          styles.arrangeTitle
                        }
                        numberOfLines={1}
                      >
                        {
                          item.title
                        }
                      </Text>

                      <Text
                        style={
                          styles.arrangeAuthor
                        }
                        numberOfLines={1}
                      >
                        {item.authors.join(
                          ', '
                        ) ||
                          'Unknown author'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.arrangeControls
                      }
                    >
                      <Pressable
                        disabled={
                          index === 0
                        }
                        hitSlop={6}
                        onPress={() =>
                          moveBook(
                            index,
                            -1
                          )
                        }
                        style={({ pressed }) => [
                          styles.arrangeControl,
                          index ===
                            0 &&
                            styles.disabled,
                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={18}
                          color={
                            colors.secondaryText
                          }
                        />
                      </Pressable>

                      <Pressable
                        disabled={
                          index ===
                          items.length -
                            1
                        }
                        hitSlop={6}
                        onPress={() =>
                          moveBook(
                            index,
                            1
                          )
                        }
                        style={({ pressed }) => [
                          styles.arrangeControl,
                          index ===
                            items.length -
                              1 &&
                            styles.disabled,
                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={
                            colors.secondaryText
                          }
                        />
                      </Pressable>

                      <Pressable
                        hitSlop={6}
                        onPress={() =>
                          removeBook(
                            index
                          )
                        }
                        style={({ pressed }) => [
                          styles.arrangeControl,
                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={
                            colors.danger
                          }
                        />
                      </Pressable>
                    </View>
                  </View>
                )
              )}
            </View>
          </View>
        ) : null}

        <View
          style={
            styles.actionSection
          }
        >
          <Pressable
            disabled={
              saving
            }
            onPress={() =>
              void saveStack(
                false
              )
            }
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed &&
                styles.pressed,
              saving &&
                styles.disabled,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.secondaryButtonText
              }
            >
              Save to Profile
            </Text>
          </Pressable>

          <Pressable
            disabled={
              saving
            }
            onPress={() =>
              void saveStack(
                true
              )
            }
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.pressed,
              saving &&
                styles.disabled,
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
              <>
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Save & Post
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={
                    colors.background
                  }
                />
              </>
            )}
          </Pressable>

          <Text
            style={
              styles.actionHint
            }
          >
            Save to Profile skips the preview. Save & Post takes you to a feed preview before publishing.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={
          searchOpen
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setSearchOpen(
            false
          )
        }
      >
        <SafeAreaView
          style={
            styles.searchSafeArea
          }
        >
          <View
            style={
              styles.searchHeader
            }
          >
            <Pressable
              onPress={() =>
                setSearchOpen(
                  false
                )
              }
              hitSlop={10}
              style={
                styles.searchClose
              }
            >
              <Ionicons
                name="close"
                size={24}
                color={
                  colors.text
                }
              />
            </Pressable>

            <Text
              style={
                styles.searchTitle
              }
            >
              Add Books
            </Text>

            <Text
              style={
                styles.searchCount
              }
            >
              {items.length}/10
            </Text>
          </View>

          <View
            style={
              styles.searchBox
            }
          >
            <Ionicons
              name="search"
              size={18}
              color={
                colors.mutedText
              }
            />

            <TextInput
              value={
                query
              }
              onChangeText={
                setQuery
              }
              placeholder="Search title or author"
              placeholderTextColor={
                colors.mutedText
              }
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              style={
                styles.searchInput
              }
            />

            {searching ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.gold
                }
              />
            ) : query ? (
              <Pressable
                onPress={() =>
                  setQuery('')
                }
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={
                    colors.mutedText
                  }
                />
              </Pressable>
            ) : null}
          </View>

          {searchError ? (
            <Text
              style={
                styles.searchError
              }
            >
              {
                searchError
              }
            </Text>
          ) : null}

          <ScrollView
            contentContainerStyle={
              styles.searchResults
            }
            keyboardShouldPersistTaps="handled"
          >
            {results.map(
              (
                book
              ) => {
                const added =
                  isAdded(
                    book.id
                  );

                const cover =
                  getBestSearchCover(
                    book.volumeInfo.imageLinks
                  );

                return (
                  <Pressable
                    key={
                      book.id
                    }
                    disabled={
                      added
                    }
                    onPress={() =>
                      addBook(
                        book
                      )
                    }
                    style={({ pressed }) => [
                      styles.searchResult,
                      added &&
                        styles.searchResultAdded,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    {cover ? (
                      <Image
                        source={{
                          uri:
                            cover,
                        }}
                        style={
                          styles.resultCover
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.resultCoverFallback
                        }
                      >
                        <Ionicons
                          name="book-outline"
                          size={20}
                          color={
                            colors.gold
                          }
                        />
                      </View>
                    )}

                    <View
                      style={
                        styles.resultCopy
                      }
                    >
                      <Text
                        style={
                          styles.resultTitle
                        }
                        numberOfLines={2}
                      >
                        {
                          book.volumeInfo.title ||
                          'Untitled'
                        }
                      </Text>

                      <Text
                        style={
                          styles.resultAuthor
                        }
                        numberOfLines={1}
                      >
                        {book.volumeInfo.authors?.join(
                          ', '
                        ) ||
                          'Unknown author'}
                      </Text>
                    </View>

                    <Ionicons
                      name={
                        added
                          ? 'checkmark-circle'
                          : 'add-circle-outline'
                      }
                      size={24}
                      color={
                        added
                          ? colors.secondaryText
                          : colors.gold
                      }
                    />
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

    header: {
      height: 54,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },

    headerButton: {
      width: 42,
      height: 42,
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
      fontSize: 19,
      textAlign:
        'center',
    },

    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 46,
    },

    intro: {
      marginBottom: 26,
    },

    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
      letterSpacing: 1.5,
    },

    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 29,
      lineHeight: 35,
      marginTop: 8,
    },

    subtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 20,
      marginTop: 8,
    },

    nameSection: {
      marginBottom: 26,
    },

    sectionLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
      letterSpacing: 1.15,
    },

    sectionSubtext: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      marginTop: 4,
    },

    nameInput: {
      minHeight: 52,
      color:
        colors.text,
      fontFamily:
        'Inter_500Medium',
      fontSize: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.border,
      paddingVertical: 12,
      marginTop: 6,
    },

    characterCount: {
      alignSelf:
        'flex-end',
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 9,
      marginTop: 5,
    },

    visualSection: {
      marginBottom: 28,
    },

    sectionHeaderRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
    },

    bookCount: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 11,
    },

    stackPreview: {
      minHeight: 500,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 16,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      paddingVertical: 22,
    },

    emptyStack: {
      minHeight: 210,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 14,
      borderWidth: 1,
      borderStyle:
        'dashed',
      borderColor:
        colors.border,
      borderRadius: 18,
      padding: 20,
    },

    emptyStackIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    emptyStackTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      marginTop: 13,
    },

    emptyStackText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      textAlign:
        'center',
      marginTop: 6,
    },

    addBookButton: {
      minHeight: 45,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 7,
      marginTop: 14,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 13,
      backgroundColor:
        colors.surface,
    },

    addBookText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },

    arrangeSection: {
      marginBottom: 30,
    },

    arrangeList: {
      marginTop: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },

    arrangeRow: {
      minHeight: 70,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
      paddingVertical: 9,
    },

    arrangeCover: {
      width: 36,
      height: 54,
      borderRadius: 5,
      backgroundColor:
        colors.elevated,
      marginRight: 10,
    },

    arrangeCoverFallback: {
      width: 36,
      height: 54,
      borderRadius: 5,
      backgroundColor:
        colors.elevated,
      marginRight: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    arrangeCopy: {
      flex: 1,
      minWidth: 0,
    },

    arrangeTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    arrangeAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 4,
    },

    arrangeControls: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 3,
    },

    arrangeControl: {
      width: 30,
      height: 30,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    actionSection: {
      gap: 10,
      paddingTop: 6,
    },

    secondaryButton: {
      minHeight: 50,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        colors.gold,
      backgroundColor:
        colors.background,
    },

    secondaryButtonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },

    primaryButton: {
      minHeight: 52,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
      borderRadius: 14,
      backgroundColor:
        colors.gold,
    },

    primaryButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },

    actionHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.5,
      lineHeight: 16,
      textAlign:
        'center',
      marginTop: 2,
    },

    searchSafeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    searchHeader: {
      height: 54,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },

    searchClose: {
      width: 42,
      height: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    searchTitle: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
      textAlign:
        'center',
    },

    searchCount: {
      width: 42,
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
      textAlign:
        'center',
    },

    searchBox: {
      minHeight: 50,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 9,
      marginHorizontal: 16,
      marginTop: 14,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },

    searchInput: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
    },

    searchError: {
      color:
        colors.danger,
      fontFamily:
        'Inter_500Medium',
      fontSize: 11,
      paddingHorizontal: 18,
      marginTop: 8,
    },

    searchResults: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 36,
    },

    searchResult: {
      minHeight: 82,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
      paddingVertical: 10,
    },

    searchResultAdded: {
      opacity: 0.48,
    },

    resultCover: {
      width: 43,
      height: 64,
      borderRadius: 6,
      backgroundColor:
        colors.elevated,
      marginRight: 11,
    },

    resultCoverFallback: {
      width: 43,
      height: 64,
      borderRadius: 6,
      backgroundColor:
        colors.elevated,
      marginRight: 11,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    resultCopy: {
      flex: 1,
      minWidth: 0,
      paddingRight: 10,
    },

    resultTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
    },

    resultAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.5,
      marginTop: 4,
    },

    previewContent: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 110,
    },

    previewEyebrowRow: {
      alignSelf:
        'flex-start',
      minHeight: 27,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      borderRadius: 999,
      paddingRight: 10,
      overflow:
        'hidden',
    },

    previewAccent: {
      width: 2,
      alignSelf:
        'stretch',
      backgroundColor:
        colors.gold,
    },

    previewEyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9.5,
      letterSpacing: 0.9,
    },

    previewName: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 25,
      lineHeight: 31,
      marginTop: 14,
    },

    postInput: {
      minHeight: 76,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 16,
      paddingVertical: 11,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      textAlignVertical:
        'top',
    },

    previewVisual: {
      minHeight: 510,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 8,
      paddingVertical: 12,
    },

    previewMeta: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 6,
      marginTop: 10,
    },

    previewMetaText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10.5,
    },

    previewMetaDot: {
      color:
        colors.mutedText,
      fontSize: 11,
    },

    previewHint: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 9,
      marginTop: 24,
      paddingTop: 14,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },

    previewHintText: {
      flex: 1,
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11.5,
      lineHeight: 17,
    },

    previewFooter: {
      position:
        'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 18,
      backgroundColor:
        colors.background,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },

    publishButton: {
      width: '100%',
      maxWidth: 680,
      minHeight: 52,
      alignSelf:
        'center',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
      borderRadius: 14,
      backgroundColor:
        colors.gold,
    },

    publishButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },

    pressed: {
      opacity: 0.72,
    },

    disabled: {
      opacity: 0.42,
    },
  });
}
