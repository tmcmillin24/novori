import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
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

import BookStackShowcase from '../components/BookStackShowcase';
import SortableBookStackRow, {
  StackDropEdge,
} from '../components/SortableBookStackRow';
import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';
import {
  getNovoriSearchBookCover,
  GoogleBookSearchItem,
  searchNovoriBooks,
} from '../lib/book-search';
import {
  resolveBookCoverUrl,
} from '../lib/book-covers';
import {
  fetchGoogleBooksJson,
  resolveGoogleBooksIdentity,
} from '../lib/google-books';
import {
  BookStackDraftItem,
  createBookStack,
  deleteBookStack,
  getBookStack,
  updateBookStack,
} from '../lib/book-stacks';
import {
  createPost,
  getPostDetail,
  updatePost,
} from '../lib/feed';
import {
  supabase,
} from '../lib/supabase';

const MAX_STACK_BOOKS = 10;
const MIN_STACK_BOOKS = 2;

type BookStackSeriesResponse = {
  series?: {
    currentPosition?:
      | number
      | null;
  } | null;
  books?: {
    position: number;
    imageUrl?:
      | string
      | null;
  }[];
};

function secureStackCoverUrl(
  value?:
    | string
    | null
) {
  return (
    value
      ?.replace(
        'http://',
        'https://'
      )
      .trim() ||
    null
  );
}

function getStackBookIsbns(
  book: GoogleBookSearchItem
) {
  return Array.from(
    new Set(
      (
        book.volumeInfo
          .industryIdentifiers ??
        []
      )
        .map(
          (
            identifier
          ) =>
            identifier.identifier
              ?.replace(
                /[^0-9Xx]/g,
                ''
              )
              .toUpperCase()
        )
        .filter(
          (
            isbn
          ): isbn is string =>
            Boolean(
              isbn
            )
        )
    )
  );
}

function getStackBookPrimaryIsbn(
  book: GoogleBookSearchItem
) {
  const identifiers =
    book.volumeInfo
      .industryIdentifiers ??
    [];

  return (
    identifiers.find(
      (
        identifier
      ) =>
        identifier.type ===
        'ISBN_13'
    )?.identifier ??
    identifiers.find(
      (
        identifier
      ) =>
        identifier.type ===
        'ISBN_10'
    )?.identifier ??
    book.novoriWork
      ?.isbns?.[0] ??
    null
  );
}

async function resolveBookStackPreviewCover(
  book: GoogleBookSearchItem,
  initialCover:
    | string
    | null
) {
  let detailBook =
    book;

  try {
    const identity =
      await resolveGoogleBooksIdentity({
        title:
          book.volumeInfo
            .title,
        author:
          book.volumeInfo
            .authors?.[0],
        isbn:
          getStackBookPrimaryIsbn(
            book
          ) ??
          undefined,
      });

    const detailId =
      identity.ok &&
      identity.googleBookId
        ? identity.googleBookId
        : book.id;

    const detail =
      await fetchGoogleBooksJson<
        GoogleBookSearchItem
      >(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
          detailId
        )}`
      );

    if (
      detail.ok &&
      detail.data
    ) {
      detailBook =
        detail.data;
    }
  } catch (
    error
  ) {
    console.warn(
      'Could not resolve Book Stack detail metadata:',
      error
    );
  }

  try {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'book-cover-selection',
        {
          body: {
            volumeId:
              detailBook.id,
          },
        }
      );

    if (!error) {
      const selection =
        data as
          | {
              ok?: boolean;
              data?: {
                locked?: boolean;
                authoritative?: boolean;
                url?:
                  | string
                  | null;
              };
            }
          | null;

      const verifiedCover =
        selection?.ok ===
          true &&
        selection.data
          ?.locked ===
          true &&
        selection.data
          ?.authoritative ===
          true
          ? secureStackCoverUrl(
              selection.data
                ?.url
            )
          : null;

      if (
        verifiedCover
      ) {
        return verifiedCover;
      }
    }
  } catch (
    error
  ) {
    console.warn(
      'Could not load verified Book Stack cover:',
      error
    );
  }

  try {
    const isbns =
      getStackBookIsbns(
        detailBook
      );

    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'hardcover-series',
        {
          body: {
            isbn:
              getStackBookPrimaryIsbn(
                detailBook
              ) ??
              isbns[0] ??
              null,
            isbns,
            title:
              detailBook.volumeInfo
                .title ??
              '',
            authors:
              detailBook.volumeInfo
                .authors ??
              [],
          },
        }
      );

    if (!error) {
      const response =
        data as
          BookStackSeriesResponse;

      const currentPosition =
        response.series
          ?.currentPosition;

      const currentSeriesBook =
        currentPosition !==
          null &&
        currentPosition !==
          undefined
          ? (
              response.books ??
              []
            ).find(
              (
                seriesBook
              ) =>
                seriesBook.position ===
                currentPosition
            )
          : null;

      const seriesCover =
        secureStackCoverUrl(
          currentSeriesBook
            ?.imageUrl
        );

      if (
        seriesCover
      ) {
        return seriesCover;
      }
    }
  } catch (
    error
  ) {
    console.warn(
      'Could not load Book Stack series cover:',
      error
    );
  }

  return (
    await resolveBookCoverUrl({
      imageLinks:
        detailBook.volumeInfo
          .imageLinks,
      isbn:
        getStackBookPrimaryIsbn(
          detailBook
        ),
      existingCoverUrl:
        initialCover,
    })
  ) ??
    initialCover;
}

export default function CreateBookStackScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      editPostId?: string;
      stackId?: string;
    }>();

  const editPostId =
    typeof params.editPostId ===
    'string'
      ? params.editPostId
      : '';

  const editStackId =
    typeof params.stackId ===
    'string'
      ? params.stackId
      : '';

  const isEditing =
    Boolean(
      editStackId
    );

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
    resolvingBookIds,
    setResolvingBookIds,
  ] =
    useState<string[]>(
      []
    );

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

  const [
    loadingExistingStack,
    setLoadingExistingStack,
  ] =
    useState(
      isEditing
    );

  const [
    draggingBookId,
    setDraggingBookId,
  ] =
    useState<
      string | null
    >(null);

  const [
    dragTargetIndex,
    setDragTargetIndex,
  ] =
    useState<
      number | null
    >(null);

  const [
    dragTargetEdge,
    setDragTargetEdge,
  ] =
    useState<
      StackDropEdge
    >(null);

  const dragStartIndexRef =
    useRef<
      number | null
    >(null);

  const dragBookIdRef =
    useRef<
      string | null
    >(null);

  const dragTargetIndexRef =
    useRef<
      number | null
    >(null);

  const timerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const requestRef =
    useRef(0);

  useEffect(() => {
    let active =
      true;

    async function loadExistingStack() {
      if (
        !isEditing
      ) {
        setLoadingExistingStack(
          false
        );
        return;
      }

      try {
        const stack =
          await getBookStack(
            editStackId
          );

        const post =
          editPostId
            ? await getPostDetail(
                editPostId
              )
            : null;

        if (
          !active
        ) {
          return;
        }

        setName(
          stack.name
        );

        setItems(
          stack.items.map(
            (
              item
            ) => ({
              googleBookId:
                item.google_book_id,
              title:
                item.title,
              authors:
                item.authors,
              coverUrl:
                item.cover_url,
            })
          )
        );

        setPostText(
          post?.body ??
            ''
        );
      } catch (
        error
      ) {
        console.error(
          'Could not load Book Stack for editing:',
          error
        );

        Alert.alert(
          'Could not load stack',
          'Please try again.',
          [
            {
              text:
                'OK',
              onPress: () =>
                router.back(),
            },
          ]
        );
      } finally {
        if (
          active
        ) {
          setLoadingExistingStack(
            false
          );
        }
      }
    }

    void loadExistingStack();

    return () => {
      active =
        false;
    };
  }, [
    editPostId,
    editStackId,
    isEditing,
    router,
  ]);

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

  function openBookSearch() {
    setSearchOpen(
      true
    );
  }

  function closeBookSearch() {
    setSearchOpen(
      false
    );
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

  async function toggleBookSelection(
    book:
      GoogleBookSearchItem
  ) {
    const alreadySelected =
      isAdded(
        book.id
      );

    if (
      alreadySelected
    ) {
      setItems(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.googleBookId !==
              book.id
          )
      );
      return;
    }

    if (
      resolvingBookIds.includes(
        book.id
      )
    ) {
      return;
    }

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

    const initialCover =
      getNovoriSearchBookCover(
        book
      );

    setResolvingBookIds(
      (
        current
      ) =>
        current.includes(
          book.id
        )
          ? current
          : [
              ...current,
              book.id,
            ]
    );

    let finalCover =
      initialCover;

    try {
      finalCover =
        await resolveBookStackPreviewCover(
          book,
          initialCover
        );
    } catch (
      error
    ) {
      console.warn(
        'Could not refine Book Stack cover:',
        error
      );
    } finally {
      setResolvingBookIds(
        (
          current
        ) =>
          current.filter(
            (
              id
            ) =>
              id !==
              book.id
          )
      );
    }

    setItems(
      (
        current
      ) => {
        if (
          current.some(
            (
              item
            ) =>
              item.googleBookId ===
              book.id
          ) ||
          current.length >=
            MAX_STACK_BOOKS
        ) {
          return current;
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
              finalCover,
          };

        return [
          ...current,
          next,
        ];
      }
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

  function moveBookTo(
    bookId: string,
    toIndex: number
  ) {
    setItems(
      (
        current
      ) => {
        const fromIndex =
          current.findIndex(
            (
              item
            ) =>
              item.googleBookId ===
              bookId
          );

        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          toIndex >=
            current.length ||
          fromIndex ===
            toIndex
        ) {
          return current;
        }

        const next = [
          ...current,
        ];

        const [
          moved,
        ] =
          next.splice(
            fromIndex,
            1
          );

        next.splice(
          toIndex,
          0,
          moved
        );

        return next;
      }
    );
  }

  function startBookDrag(
    bookId: string,
    index: number
  ) {
    dragStartIndexRef.current =
      index;

    dragBookIdRef.current =
      bookId;

    dragTargetIndexRef.current =
      index;

    setDraggingBookId(
      bookId
    );

    setDragTargetIndex(
      index
    );

    setDragTargetEdge(
      null
    );
  }

  function moveBookDrag(
    bookId: string,
    translationY: number
  ) {
    const startIndex =
      dragStartIndexRef.current;

    if (
      startIndex ===
      null
    ) {
      return;
    }

    const rowHeight =
      72;

    const rawPosition =
      startIndex +
      translationY /
        rowHeight;

    const targetIndex =
      Math.max(
        0,
        Math.min(
          items.length -
            1,
          Math.round(
            rawPosition
          )
        )
      );

    const fraction =
      rawPosition -
      Math.floor(
        rawPosition
      );

    const edge:
      StackDropEdge =
        translationY ===
        0
          ? null
          : translationY >
            0
          ? fraction <
            0.5
            ? 'top'
            : 'bottom'
          : fraction >
            0.5
          ? 'bottom'
          : 'top';

    dragTargetIndexRef.current =
      targetIndex;

    setDragTargetIndex(
      targetIndex
    );

    setDragTargetEdge(
      edge
    );
  }

  function endBookDrag() {
    const draggedBookId =
      dragBookIdRef.current;

    const targetIndex =
      dragTargetIndexRef.current;

    if (
      draggedBookId &&
      targetIndex !==
        null
    ) {
      moveBookTo(
        draggedBookId,
        targetIndex
      );
    }

    dragStartIndexRef.current =
      null;

    dragBookIdRef.current =
      null;

    dragTargetIndexRef.current =
      null;

    setDraggingBookId(
      null
    );

    setDragTargetIndex(
      null
    );

    setDragTargetEdge(
      null
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

      if (
        isEditing
      ) {
        await updateBookStack(
          editStackId,
          name,
          items
        );

        if (
          editPostId
        ) {
          await updatePost(
            editPostId,
            {
              body:
                postText.trim() ||
                name.trim(),
            }
          );

          router.replace(
            '/(tabs)'
          );
        } else {
          router.replace(
            '/(tabs)/profile'
          );
        }
      } else {
        await createBookStack(
          name,
          items
        );

        router.replace(
          '/(tabs)/profile'
        );
      }
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

    let createdStackId:
      string | null =
        null;

    try {
      setPublishing(
        true
      );

      if (
        isEditing
      ) {
        const stack =
          await updateBookStack(
            editStackId,
            name,
            items
          );

        if (
          editPostId
        ) {
          await updatePost(
            editPostId,
            {
              body:
                postText.trim() ||
                stack.name,
            }
          );
        } else {
          await createPost({
            body:
              postText.trim() ||
              stack.name,
            postType:
              'book_stack',
            bookStackId:
              stack.id,
          });
        }
      } else {
        const stack =
          await createBookStack(
            name,
            items
          );

        createdStackId =
          stack.id;

        await createPost({
          body:
            postText.trim() ||
            stack.name,
          postType:
            'book_stack',
          bookStackId:
            stack.id,
        });
      }

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

      if (
        createdStackId
      ) {
        try {
          await deleteBookStack(
            createdStackId
          );
        } catch (
          cleanupError
        ) {
          console.warn(
            'Could not clean up unpublished Book Stack:',
            cleanupError
          );
        }
      }

      const message =
        error &&
        typeof error ===
          'object' &&
        'message' in error &&
        typeof error.message ===
          'string'
          ? error.message
          : 'Please try again.';

      const schemaIssue =
        message.includes(
          'post_type'
        ) ||
        message.includes(
          'book_stack_id'
        ) ||
        message.includes(
          'schema cache'
        );

      Alert.alert(
        'Could not publish stack',
        schemaIssue
          ? `${message}\n\nThe Phase 6 Supabase migration needs to be rerun so posts accept Book Stacks.`
          : message
      );
    } finally {
      setPublishing(
        false
      );
    }
  }

  const previewDraftItems =
    draggingBookId &&
    dragTargetIndex !==
      null
      ? (() => {
          const fromIndex =
            items.findIndex(
              (
                item
              ) =>
                item.googleBookId ===
                draggingBookId
            );

          if (
            fromIndex < 0 ||
            fromIndex ===
              dragTargetIndex
          ) {
            return items;
          }

          const next = [
            ...items,
          ];

          const [
            moved,
          ] =
            next.splice(
              fromIndex,
              1
            );

          next.splice(
            dragTargetIndex,
            0,
            moved
          );

          return next;
        })()
      : items;

  const visualItems =
    previewDraftItems.map(
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
    loadingExistingStack
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={{
            flex: 1,
            alignItems:
              'center',
            justifyContent:
              'center',
          }}
        >
          <ActivityIndicator
            size="small"
            color={
              colors.gold
            }
          />
        </View>
      </SafeAreaView>
    );
  }

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
            {isEditing
              ? 'Edit Preview'
              : 'Preview'}
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
            Feed Preview
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

          <BookStackShowcase
            name={
              name.trim() ||
              'Untitled Book Stack'
            }
            items={
              visualItems
            }
            variant="feed"
          />

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
              This stack will be saved to your profile when you publish.
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
                  {isEditing
                    ? 'Save Changes'
                    : 'Publish'}
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
        scrollEnabled={
          !draggingBookId
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
            <>
              <BookStackShowcase
                name={
                  name.trim() ||
                  'Untitled Book Stack'
                }
                items={
                  visualItems
                }
                variant="builder"
              />
            </>
          ) : (
            <Pressable
              onPress={() =>
                openBookSearch()
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
            onPress={
              openBookSearch
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
              Hold the grip, then drag up or down. The stack preview updates as you move.
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
                  <SortableBookStackRow
                    key={
                      item.googleBookId
                    }
                    item={
                      item
                    }
                    index={
                      index
                    }
                    isDragging={
                      draggingBookId ===
                      item.googleBookId
                    }
                    dropEdge={
                      dragTargetIndex ===
                        index
                        ? dragTargetEdge
                        : null
                    }
                    onDragStart={
                      startBookDrag
                    }
                    onDragMove={
                      moveBookDrag
                    }
                    onDragEnd={
                      endBookDrag
                    }
                    onRemove={() =>
                      removeBook(
                        index
                      )
                    }
                    colors={
                      colors
                    }
                  />
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
        onRequestClose={
          closeBookSearch
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
              onPress={
                closeBookSearch
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
                  getNovoriSearchBookCover(
                    book
                  );

                const resolving =
                  resolvingBookIds.includes(
                    book.id
                  );

                return (
                  <Pressable
                    key={
                      book.id
                    }
                    onPress={() =>
                      void toggleBookSelection(
                        book
                      )
                    }
                    style={({ pressed }) => [
                      styles.searchResult,
                      added &&
                        styles.searchResultSelected,
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

                    {resolving ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.gold
                        }
                      />
                    ) : (
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
                    )}
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
      minHeight: 245,
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
      paddingTop: 18,
      paddingBottom: 10,
    },

    featuredSummary: {
      alignItems:
        'center',
      paddingTop: 10,
      paddingBottom: 7,
    },

    featuredSummaryLabel: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
    },

    featuredSummaryEyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 8.5,
      letterSpacing: 0.85,
    },

    featuredSummaryTitle: {
      maxWidth: 250,
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      marginTop: 5,
      textAlign:
        'center',
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

    searchResultSelected: {
      backgroundColor:
        colors.elevated,
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

    previewStackBlock: {
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 14,
      paddingTop: 20,
      paddingBottom: 16,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },

    previewStackCaption: {
      alignItems:
        'center',
      marginTop: 5,
      paddingHorizontal: 12,
    },

    previewStackTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 20,
      lineHeight: 25,
      textAlign:
        'center',
    },

    previewStackCount: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10.5,
      marginTop: 4,
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
