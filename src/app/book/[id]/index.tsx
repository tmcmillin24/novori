import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '../../../constants/novori-theme';
import { supabase } from '../../../lib/supabase';
import {
  getUserBook,
  removeUserBook,
  saveUserBook,
  updateBookReadingDates,
  UserBook,
  UserBookStatus,
} from '../../../lib/user-books';

type GoogleBook = {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
  };
};

type HardcoverSeriesBook = {
  position: number;
  id: number;
  title: string;
  slug?: string | null;
  releaseDate?: string | null;
  imageUrl?: string | null;
  authors: string[];
  isbns: string[];
};

type HardcoverSeries = {
  id: number;
  name: string;
  slug?: string | null;
  currentPosition?: number | null;
};

type HardcoverSeriesResponse = {
  series: HardcoverSeries | null;
  books: HardcoverSeriesBook[];
  error?: string;
  details?: unknown;
};

type GoogleSearchResponse = {
  totalItems?: number;
  items?: GoogleBook[];
};

function cleanDescription(description?: string) {
  if (!description) {
    return '';
  }

  return description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getBookISBN(book: GoogleBook) {
  const identifiers = book.volumeInfo.industryIdentifiers ?? [];

  const isbn13 = identifiers.find(
    (item) => item.type === 'ISBN_13'
  )?.identifier;

  if (isbn13) {
    return isbn13;
  }

  const isbn10 = identifiers.find(
    (item) => item.type === 'ISBN_10'
  )?.identifier;

  return isbn10;
}

function normalizeTitle(title?: string) {
  return title?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
}

function getYear(date?: string | null) {
  if (!date) {
    return null;
  }

  const year = date.substring(0, 4);

  if (!/^\d{4}$/.test(year)) {
    return null;
  }

  return year;
}

function formatPublishedDate(date?: string) {
  if (!date) {
    return undefined;
  }

  if (/^\d{4}$/.test(date)) {
    return date;
  }

  if (/^\d{4}-\d{2}$/.test(date)) {
    const [year, month] = date.split('-');
    const monthIndex = Number(month) - 1;

    if (monthIndex >= 0 && monthIndex <= 11) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
      }).format(
        new Date(
          Number(year),
          monthIndex,
          1
        )
      );
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] =
      date.split('-');

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(
      new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      )
    );
  }

  return date;
}


function formatReadingDate(
  value?: string | null
) {
  if (!value) {
    return 'Not recorded';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  ).format(date);
}

function dateInputFromIso(
  value?: string | null
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

  const month =
    `${date.getMonth() + 1}`.padStart(
      2,
      '0'
    );

  const day =
    `${date.getDate()}`.padStart(
      2,
      '0'
    );

  return `${month}/${day}/${date.getFullYear()}`;
}

function formatDateInput(
  nextValue: string,
  previousValue: string
) {
  if (
    nextValue.length <
      previousValue.length &&
    previousValue.endsWith(
      '/'
    ) &&
    nextValue ===
      previousValue.slice(
        0,
        -1
      )
  ) {
    return nextValue;
  }

  const digits =
    nextValue
      .replace(
        /\D/g,
        ''
      )
      .slice(
        0,
        8
      );

  if (
    digits.length <= 2
  ) {
    return digits;
  }

  if (
    digits.length <= 4
  ) {
    return `${digits.slice(
      0,
      2
    )}/${digits.slice(
      2
    )}`;
  }

  return `${digits.slice(
    0,
    2
  )}/${digits.slice(
    2,
    4
  )}/${digits.slice(
    4
  )}`;
}

function parseDateInput(
  value: string
) {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  const match =
    trimmed.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (!match) {
    throw new Error(
      'Use MM/DD/YYYY for reading dates.'
    );
  }

  const month =
    Number(match[1]);

  const day =
    Number(match[2]);

  const year =
    Number(match[3]);

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );

  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    throw new Error(
      'Enter a valid calendar date.'
    );
  }

  return date.toISOString();
}

function getDisplayTitle(
  title?: string
) {
  if (
    title &&
    title.trim() &&
    title.trim().toLowerCase() !== 'untitled'
  ) {
    return title;
  }

  return 'Unannounced';
}

export default function BookDetailsScreen() {
  const router = useRouter();

  const { id, source } = useLocalSearchParams<{
    id: string;
    source?: string;
  }>();

  const [book, setBook] = useState<GoogleBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [descriptionExpanded, setDescriptionExpanded] =
    useState(false);
  const [readingStatus, setReadingStatus] =
    useState<UserBookStatus | null>(null);
  const [savedBook, setSavedBook] =
    useState<UserBook | null>(null);
  const [dateEditorVisible, setDateEditorVisible] =
    useState(false);
  const [startedDateInput, setStartedDateInput] =
    useState('');
  const [endedDateInput, setEndedDateInput] =
    useState('');
  const [savingDates, setSavingDates] =
    useState(false);
  const [savingStatus, setSavingStatus] =
    useState<UserBookStatus | null>(null);
  const [removingBook, setRemovingBook] =
    useState(false);
  const [series, setSeries] =
    useState<HardcoverSeries | null>(null);
  const [seriesBooks, setSeriesBooks] =
    useState<HardcoverSeriesBook[]>([]);
  const [seriesLoading, setSeriesLoading] =
    useState(false);
  const [seriesExpanded, setSeriesExpanded] =
    useState(false);
  const [openingSeriesBookId, setOpeningSeriesBookId] =
    useState<number | null>(null);

  const backLabel =
    source === 'library'
      ? 'Library'
      : source === 'currently-reading'
      ? 'Currently Reading'
      : source === 'profile'
      ? 'Profile'
      : source === 'discover'
      ? 'Discover'
      : 'Back';

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (source === 'library') {
      router.replace('/(tabs)/library');
      return;
    }

    if (source === 'currently-reading') {
      router.replace('/currently-reading');
      return;
    }

    if (source === 'profile') {
      router.replace('/(tabs)/profile');
      return;
    }

    if (source === 'discover') {
      router.replace('/(tabs)/discover');
      return;
    }

    router.replace('/(tabs)/discover');
  }

  useEffect(() => {
    async function loadBook() {
      if (!id) {
        return;
      }

      try {
        setLoading(true);
        setError('');
        setSeries(null);
        setSeriesBooks([]);
        setSeriesExpanded(false);

        const apiKey =
          process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

        if (!apiKey) {
          throw new Error('Google Books API key is missing.');
        }

        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes/${id}?key=${apiKey}`
        );

        if (!response.ok) {
          throw new Error(
            `Google Books request failed: ${response.status}`
          );
        }

        const data: GoogleBook = await response.json();

        setBook(data);

        try {
          const savedBook = await getUserBook(data.id);
          setSavedBook(savedBook);
          setReadingStatus(savedBook?.status ?? null);
        } catch (statusError) {
          console.error(
            'Could not load saved reading status:',
            statusError
          );
          setSavedBook(null);
          setReadingStatus(null);
        }

        await loadSeries(data);
      } catch (err) {
        console.error('Book loading error:', err);
        setError('Could not load this book.');
      } finally {
        setLoading(false);
      }
    }

    loadBook();
  }, [id]);

  async function loadSeries(currentBook: GoogleBook) {
    const isbn = getBookISBN(currentBook);

    if (!isbn) {
      console.log('No ISBN available for Hardcover lookup.');
      return;
    }

    try {
      setSeriesLoading(true);
      setSeries(null);
      setSeriesBooks([]);

      const { data, error: functionError } =
        await supabase.functions.invoke('hardcover-series', {
          body: { isbn },
        });

      if (functionError) {
        console.error(
          'Hardcover Edge Function error:',
          functionError
        );
        return;
      }

      const response = data as HardcoverSeriesResponse;

      if (response.error) {
        console.error(
          'Hardcover response error:',
          response.error,
          response.details
        );
        return;
      }

      setSeries(response.series ?? null);
      setSeriesBooks(response.books ?? []);
    } catch (err) {
      console.error('Series lookup failed:', err);
      setSeries(null);
      setSeriesBooks([]);
    } finally {
      setSeriesLoading(false);
    }
  }

  async function findGoogleBookId(
    seriesBook: HardcoverSeriesBook
  ) {
    const apiKey =
      process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
      throw new Error('Google Books API key is missing.');
    }

    const author = seriesBook.authors?.[0];
    const queryParts = [`intitle:"${seriesBook.title}"`];

    if (author) {
      queryParts.push(`inauthor:"${author}"`);
    }

    const query = queryParts.join(' ');

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        query
      )}&maxResults=20&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(
        `Google Books search failed: ${response.status}`
      );
    }

    const data: GoogleSearchResponse = await response.json();
    const results = data.items ?? [];

    if (results.length === 0) {
      return null;
    }

    const wantedTitle = normalizeTitle(seriesBook.title);

    const exactTitle = results.find(
      (result) =>
        normalizeTitle(result.volumeInfo.title) === wantedTitle
    );

    if (exactTitle) {
      return exactTitle.id;
    }

    const titleAndAuthor = results.find((result) => {
      const resultTitle = normalizeTitle(result.volumeInfo.title);
      const resultAuthors = result.volumeInfo.authors ?? [];

      const titleMatches =
        resultTitle.includes(wantedTitle) ||
        wantedTitle.includes(resultTitle);

      const authorMatches =
        !author ||
        resultAuthors.some((resultAuthor) =>
          resultAuthor
            .toLowerCase()
            .includes(author.toLowerCase())
        );

      return titleMatches && authorMatches;
    });

    if (titleAndAuthor) {
      return titleAndAuthor.id;
    }

    return results[0]?.id ?? null;
  }

  async function saveReadingStatus(
    status: UserBookStatus
  ) {
    if (!book || savingStatus) {
      return;
    }

    const info = book.volumeInfo;

    const coverUrl =
      info.imageLinks?.extraLarge?.replace('http://', 'https://') ||
      info.imageLinks?.large?.replace('http://', 'https://') ||
      info.imageLinks?.medium?.replace('http://', 'https://') ||
      info.imageLinks?.thumbnail?.replace('http://', 'https://') ||
      null;

    try {
      setSavingStatus(status);

      const updatedBook =
        await saveUserBook({
          googleBookId: book.id,
          title: info.title ?? 'Untitled',
          authors: info.authors ?? [],
          coverUrl,
          isbn: getBookISBN(book) ?? null,
          publishedDate: info.publishedDate ?? null,
          status,
        });

      setSavedBook(updatedBook);
      setReadingStatus(updatedBook.status);

      if (
        status === 'read' ||
        status === 'dnf'
      ) {
        router.push({
          pathname: '/rate-review',
          params: {
            googleBookId: book.id,
          },
        });
      }
    } catch (saveError) {
      console.error(
        'Could not save book status:',
        saveError
      );

      Alert.alert(
        'Could not save book',
        'Novori had trouble updating your library. Please try again.'
      );
    } finally {
      setSavingStatus(null);
    }
  }

  function confirmRemoveFromLibrary() {
    if (
      !book ||
      !readingStatus ||
      savingStatus ||
      removingBook
    ) {
      return;
    }

    Alert.alert(
      'Remove from Library?',
      `Remove ${book.volumeInfo.title ?? 'this book'} from your Novori library? This will also remove its saved rating and review.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: removeFromLibrary,
        },
      ]
    );
  }

  async function removeFromLibrary() {
    if (
      !book ||
      removingBook
    ) {
      return;
    }

    try {
      setRemovingBook(true);

      await removeUserBook(
        book.id
      );

      setSavedBook(null);
      setReadingStatus(null);
    } catch (removeError) {
      console.error(
        'Could not remove book from library:',
        removeError
      );

      Alert.alert(
        'Could not remove book',
        'Novori had trouble removing this book from your library. Please try again.'
      );
    } finally {
      setRemovingBook(false);
    }
  }

  function openReadingDateEditor() {
    if (
      !savedBook ||
      savedBook.status ===
        'want_to_read'
    ) {
      return;
    }

    setStartedDateInput(
      dateInputFromIso(
        savedBook.started_at
      )
    );

    if (
      savedBook.status ===
      'read'
    ) {
      setEndedDateInput(
        dateInputFromIso(
          savedBook.finished_at
        )
      );
    } else if (
      savedBook.status ===
      'dnf'
    ) {
      setEndedDateInput(
        dateInputFromIso(
          savedBook.dnf_at
        )
      );
    } else {
      setEndedDateInput(
        ''
      );
    }

    setDateEditorVisible(
      true
    );
  }

  function closeReadingDateEditor() {
    if (savingDates) {
      return;
    }

    setDateEditorVisible(
      false
    );
  }

  async function saveReadingDates() {
    if (
      !book ||
      !savedBook ||
      savingDates
    ) {
      return;
    }

    try {
      const startedAt =
        parseDateInput(
          startedDateInput
        );

      let finishedAt =
        savedBook.finished_at;

      let dnfAt =
        savedBook.dnf_at;

      if (
        savedBook.status ===
        'reading'
      ) {
        finishedAt =
          null;
        dnfAt =
          null;
      }

      if (
        savedBook.status ===
        'read'
      ) {
        finishedAt =
          parseDateInput(
            endedDateInput
          );

        if (!finishedAt) {
          throw new Error(
            'A finished date is required for a book marked Read.'
          );
        }

        dnfAt =
          null;
      }

      if (
        savedBook.status ===
        'dnf'
      ) {
        dnfAt =
          parseDateInput(
            endedDateInput
          );

        if (!dnfAt) {
          throw new Error(
            'A stopped date is required for a DNF book.'
          );
        }

        finishedAt =
          null;
      }

      const endDate =
        savedBook.status ===
        'read'
          ? finishedAt
          : savedBook.status ===
            'dnf'
          ? dnfAt
          : null;

      if (
        startedAt &&
        endDate &&
        new Date(endDate).getTime() <
          new Date(startedAt).getTime()
      ) {
        throw new Error(
          'The ending date cannot be before the started date.'
        );
      }

      setSavingDates(
        true
      );

      const updatedBook =
        await updateBookReadingDates({
          googleBookId:
            book.id,
          startedAt,
          finishedAt,
          dnfAt,
        });

      setSavedBook(
        updatedBook
      );

      setDateEditorVisible(
        false
      );
    } catch (dateError) {
      const message =
        dateError instanceof Error
          ? dateError.message
          : 'Novori could not update these dates.';

      Alert.alert(
        'Check reading dates',
        message
      );
    } finally {
      setSavingDates(
        false
      );
    }
  }

  async function openSeriesBook(
    seriesBook: HardcoverSeriesBook
  ) {
    if (series?.currentPosition === seriesBook.position) {
      return;
    }

    const displayTitle = getDisplayTitle(
      seriesBook.title
    );

    if (displayTitle === 'Unannounced') {
      Alert.alert(
        displayTitle,
        'This book does not have a usable title yet.'
      );
      return;
    }

    try {
      setOpeningSeriesBookId(seriesBook.id);

      const googleBookId = await findGoogleBookId(seriesBook);

      if (!googleBookId) {
        Alert.alert(
          'Book not found',
          'Novori could not find this book in Google Books yet.'
        );
        return;
      }

      router.push({
        pathname: '/book/[id]',
        params: {
          id: googleBookId,
          ...(source
            ? {
                source,
              }
            : {}),
        },
      });
    } catch (err) {
      console.error('Could not open series book:', err);

      Alert.alert(
        'Could not open book',
        'Novori had trouble finding this book. Please try again.'
      );
    } finally {
      setOpeningSeriesBookId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>Opening book...</Text>
      </View>
    );
  }

  if (error || !book) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>
          {error || 'Book not found.'}
        </Text>

        <Pressable
          style={styles.backButtonLarge}
          onPress={handleBack}
        >
          <Text style={styles.backButtonLargeText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const info = book.volumeInfo;

  const cover =
    info.imageLinks?.extraLarge?.replace('http://', 'https://') ||
    info.imageLinks?.large?.replace('http://', 'https://') ||
    info.imageLinks?.medium?.replace('http://', 'https://') ||
    info.imageLinks?.thumbnail?.replace('http://', 'https://');

  const categories =
    info.categories
      ?.slice(0, 2)
      .join(' • ');

  const publishedDate =
    formatPublishedDate(
      info.publishedDate
    );

  const description =
    cleanDescription(
      info.description
    );

  const statuses: {
    value: UserBookStatus;
    label: string;
    icon:
      keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      value: 'want_to_read',
      label: 'TBR',
      icon: 'bookmark-outline',
    },
    {
      value: 'reading',
      label: 'Reading',
      icon: 'book-outline',
    },
    {
      value: 'read',
      label: 'Read',
      icon: 'checkmark-circle-outline',
    },
    {
      value: 'dnf',
      label: 'DNF',
      icon: 'close-circle-outline',
    },
  ];

  const selectedStatusLabel =
    statuses.find(
      (status) => status.value === readingStatus
    )?.label ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color={COLORS.text}
          />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.hero}>
          {cover ? (
            <Image
              source={{ uri: cover }}
              style={styles.cover}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons
                name="book-outline"
                size={44}
                color={COLORS.mutedText}
              />
              <Text style={styles.noCoverText}>No Cover</Text>
            </View>
          )}

          <Text style={styles.title}>
            {info.title ?? 'Untitled'}
          </Text>

          {info.subtitle ? (
            <Text style={styles.subtitle}>
              {info.subtitle}
            </Text>
          ) : null}

          <Text style={styles.author}>
            {info.authors?.join(', ') ?? 'Unknown author'}
          </Text>

          {series ? (
            <View style={styles.seriesBadge}>
              <Text style={styles.seriesBadgeText}>
                {series.currentPosition
                  ? `Book ${series.currentPosition}`
                  : series.name}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statusSection}>
          <View style={styles.statusHeadingRow}>
            <View>
              <Text style={styles.statusHeading}>
                Your Reading Status
              </Text>
              <Text style={styles.statusSubheading}>
                Keep this book organized in your library.
              </Text>
            </View>
          </View>

          <View style={styles.statusGrid}>
            {statuses.map((status) => {
              const selected =
                readingStatus === status.value;

              const saving =
                savingStatus === status.value;

              return (
                <Pressable
                  key={status.value}
                  disabled={savingStatus !== null}
                  onPress={() =>
                    saveReadingStatus(status.value)
                  }
                  style={({ pressed }) => [
                    styles.statusButton,
                    selected &&
                      styles.statusButtonSelected,
                    pressed &&
                      savingStatus === null &&
                      styles.statusButtonPressed,
                    savingStatus !== null &&
                      !saving &&
                      styles.statusButtonDisabled,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.gold}
                    />
                  ) : (
                    <>
                      <View
                        style={[
                          styles.statusIconWrap,
                          selected &&
                            styles.statusIconWrapSelected,
                        ]}
                      >
                        <Ionicons
                          name={status.icon}
                          size={18}
                          color={
                            selected
                              ? COLORS.gold
                              : COLORS.secondaryText
                          }
                        />
                      </View>

                      <Text
                        style={[
                          styles.statusButtonText,
                          selected &&
                            styles.statusButtonTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {status.label}
                      </Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>

          {selectedStatusLabel ? (
            <View style={styles.statusFooterRow}>
              <View style={styles.savedStatusRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={COLORS.softGold}
                />
                <Text style={styles.statusConfirmation}>
                  Saved to your library
                </Text>
              </View>

              {readingStatus ? (
                <Pressable
                  accessibilityLabel="Remove from Library"
                  disabled={
                    savingStatus !== null ||
                    removingBook
                  }
                  onPress={
                    confirmRemoveFromLibrary
                  }
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.removeLibraryIconButton,
                    pressed &&
                      styles.removeLibraryIconButtonPressed,
                    (savingStatus !== null ||
                      removingBook) &&
                      styles.removeLibraryIconButtonDisabled,
                  ]}
                >
                  {removingBook ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.mutedText}
                    />
                  ) : (
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={COLORS.mutedText}
                    />
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {savedBook &&
        savedBook.status !==
          'want_to_read' ? (
          <View style={styles.readingDatesSection}>
            <View style={styles.readingDatesHeader}>
              <Text style={styles.sectionLabel}>
                READING DATES
              </Text>

              <Pressable
                onPress={
                  openReadingDateEditor
                }
                hitSlop={8}
                style={({ pressed }) => [
                  styles.editDatesButton,
                  pressed &&
                    styles.editDatesButtonPressed,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={COLORS.gold}
                />

                <Text style={styles.editDatesText}>
                  Edit
                </Text>
              </Pressable>
            </View>

            <View style={styles.readingDatesCard}>
              <View style={styles.readingDateCompactItem}>
                <Text style={styles.readingDateLabel}>
                  Started
                </Text>

                <Text
                  style={styles.readingDateValue}
                  numberOfLines={1}
                >
                  {formatReadingDate(
                    savedBook.started_at
                  )}
                </Text>
              </View>

              {savedBook.status ===
              'read' ? (
                <>
                  <View style={styles.readingDateVerticalDivider} />

                  <View style={styles.readingDateCompactItem}>
                    <Text style={styles.readingDateLabel}>
                      Finished
                    </Text>

                    <Text
                      style={styles.readingDateValue}
                      numberOfLines={1}
                    >
                      {formatReadingDate(
                        savedBook.finished_at
                      )}
                    </Text>
                  </View>
                </>
              ) : null}

              {savedBook.status ===
              'dnf' ? (
                <>
                  <View style={styles.readingDateVerticalDivider} />

                  <View style={styles.readingDateCompactItem}>
                    <Text style={styles.readingDateLabel}>
                      Stopped
                    </Text>

                    <Text
                      style={styles.readingDateValue}
                      numberOfLines={1}
                    >
                      {formatReadingDate(
                        savedBook.dnf_at
                      )}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.detailsSection}>
          <Text style={styles.sectionLabel}>
            BOOK DETAILS
          </Text>

          <View style={styles.metadataCard}>
            <View style={styles.metadataTopRow}>
              <View style={styles.metadataStat}>
                <View style={styles.metadataIconWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={17}
                    color={COLORS.gold}
                  />
                </View>

                <Text style={styles.metadataLabel}>
                  Published
                </Text>

                <Text
                  style={styles.metadataStatValue}
                  numberOfLines={1}
                >
                  {publishedDate ?? '—'}
                </Text>
              </View>

              <View style={styles.metadataVerticalDivider} />

              <View style={styles.metadataStat}>
                <View style={styles.metadataIconWrap}>
                  <Ionicons
                    name="document-text-outline"
                    size={17}
                    color={COLORS.gold}
                  />
                </View>

                <Text style={styles.metadataLabel}>
                  Pages
                </Text>

                <Text
                  style={styles.metadataStatValue}
                  numberOfLines={1}
                >
                  {info.pageCount
                    ? `${info.pageCount}`
                    : '—'}
                </Text>
              </View>
            </View>

            {categories ? (
              <>
                <View style={styles.metadataHorizontalDivider} />

                <View style={styles.genreRow}>
                  <View style={styles.genreIconWrap}>
                    <Ionicons
                      name="pricetag-outline"
                      size={17}
                      color={COLORS.gold}
                    />
                  </View>

                  <View style={styles.genreTextWrap}>
                    <Text style={styles.metadataLabel}>
                      Genre
                    </Text>

                    <Text
                      style={styles.genreValue}
                      numberOfLines={2}
                    >
                      {categories}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {seriesLoading ? (
          <View style={styles.seriesSection}>
            <Text style={styles.sectionHeading}>Series</Text>
            <View style={styles.seriesLoading}>
              <ActivityIndicator color={COLORS.gold} />
              <Text style={styles.seriesLoadingText}>
                Checking series...
              </Text>
            </View>
          </View>
        ) : series && seriesBooks.length > 0 ? (
          <View style={styles.seriesSection}>
            <Text style={styles.sectionHeading}>Series</Text>

            <Pressable
              onPress={() =>
                setSeriesExpanded((current) => !current)
              }
              style={({ pressed }) => [
                styles.seriesToggle,
                pressed && styles.seriesTogglePressed,
              ]}
            >
              <View style={styles.seriesToggleIcon}>
                <Ionicons
                  name="library-outline"
                  size={21}
                  color={COLORS.gold}
                />
              </View>

              <View style={styles.seriesToggleText}>
                <Text style={styles.seriesToggleName}>
                  {series.name}
                </Text>

                <Text style={styles.seriesToggleMeta}>
                  {seriesBooks.length}{' '}
                  {seriesBooks.length === 1 ? 'book' : 'books'}
                  {series.currentPosition
                    ? ` • Current: Book ${series.currentPosition}`
                    : ''}
                </Text>
              </View>

              <Ionicons
                name={
                  seriesExpanded
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={20}
                color={COLORS.softGold}
              />
            </Pressable>

            {seriesExpanded ? (
              <View style={styles.seriesCard}>
                {seriesBooks.map((seriesBook, index) => {
                  const isCurrent =
                    series.currentPosition ===
                    seriesBook.position;

                  const isOpening =
                    openingSeriesBookId === seriesBook.id;

                  const year = getYear(seriesBook.releaseDate);

                  const displayTitle = getDisplayTitle(
                    seriesBook.title
                  );

                  const hasUsableTitle =
                    displayTitle !== 'Unannounced';

                  return (
                    <Pressable
                      key={seriesBook.id}
                      disabled={
                        isCurrent ||
                        isOpening ||
                        !hasUsableTitle
                      }
                      onPress={() => openSeriesBook(seriesBook)}
                      style={({ pressed }) => [
                        styles.seriesRow,
                        index === seriesBooks.length - 1 &&
                          styles.seriesRowLast,
                        pressed &&
                          !isCurrent &&
                          hasUsableTitle &&
                          styles.seriesRowPressed,
                      ]}
                    >
                      {seriesBook.imageUrl ? (
                        <Image
                          source={{ uri: seriesBook.imageUrl }}
                          style={styles.seriesCover}
                        />
                      ) : (
                        <View
                          style={styles.seriesCoverPlaceholder}
                        >
                          <Ionicons
                            name="book-outline"
                            size={20}
                            color={COLORS.mutedText}
                          />
                        </View>
                      )}

                      <View style={styles.seriesBookText}>
                        <View style={styles.seriesTitleRow}>
                          <Text style={styles.seriesNumber}>
                            {seriesBook.position}.
                          </Text>

                          <Text
                            style={[
                              styles.seriesBookTitle,
                              isCurrent &&
                                styles.seriesBookTitleCurrent,
                              !hasUsableTitle &&
                                styles.seriesBookTitleUnavailable,
                            ]}
                            numberOfLines={2}
                          >
                            {displayTitle}
                          </Text>
                        </View>

                        {isCurrent ? (
                          <View style={styles.currentBookRow}>
                            <Ionicons
                              name="eye-outline"
                              size={13}
                              color={COLORS.softGold}
                            />
                            <Text style={styles.currentBookLabel}>
                              Currently viewing
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.seriesBookMeta}>
                            {year
                              ? year
                              : hasUsableTitle
                              ? 'View book'
                              : 'Details not announced'}
                          </Text>
                        )}
                      </View>

                      {isOpening ? (
                        <ActivityIndicator
                          size="small"
                          color={COLORS.gold}
                        />
                      ) : !isCurrent && hasUsableTitle ? (
                        <Ionicons
                          name="chevron-forward"
                          size={19}
                          color={COLORS.mutedText}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.descriptionSection}>
          <Text style={styles.sectionHeading}>About this book</Text>

          {description ? (
            <>
              <Text
                style={styles.description}
                numberOfLines={
                  descriptionExpanded ? undefined : 7
                }
              >
                {description}
              </Text>

              <Pressable
                onPress={() =>
                  setDescriptionExpanded(!descriptionExpanded)
                }
              >
                <Text style={styles.readMore}>
                  {descriptionExpanded
                    ? 'Show less'
                    : 'Read more'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.noDescription}>
              No description is available for this edition.
            </Text>
          )}
        </View>

        <Pressable style={styles.communityCard}>
          <View style={styles.communityIcon}>
            <Ionicons
              name="chatbubbles-outline"
              size={24}
              color={COLORS.gold}
            />
          </View>

          <View style={styles.communityText}>
            <Text style={styles.communityTitle}>
              Discuss this book
            </Text>
            <Text style={styles.communityDescription}>
              Reviews, reactions, questions, and reader discussions.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color={COLORS.mutedText}
          />
        </Pressable>
      </ScrollView>

      <Modal
        visible={dateEditorVisible}
        transparent
        animationType="fade"
        onRequestClose={
          closeReadingDateEditor
        }
      >
        <View style={styles.dateModalBackdrop}>
          <View style={styles.dateModalCard}>
            <View style={styles.dateModalHeader}>
              <View style={styles.dateModalHeaderText}>
                <Text style={styles.dateModalTitle}>
                  Edit Reading Dates
                </Text>

                <Text
                  style={styles.dateModalSubtitle}
                  numberOfLines={2}
                >
                  {book?.volumeInfo.title ??
                    'Book'}
                </Text>
              </View>

              <Pressable
                onPress={
                  closeReadingDateEditor
                }
                hitSlop={8}
                disabled={savingDates}
                style={({ pressed }) => [
                  styles.dateModalClose,
                  pressed &&
                    styles.dateModalClosePressed,
                ]}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.mutedText}
                />
              </Pressable>
            </View>

            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>
                Started
              </Text>

              <TextInput
                value={startedDateInput}
                onChangeText={(value) =>
                  setStartedDateInput(
                    formatDateInput(
                      value,
                      startedDateInput
                    )
                  )
                }
                placeholder="MM/DD/YYYY"
                placeholderTextColor={
                  COLORS.mutedText
                }
                keyboardType="number-pad"
                maxLength={10}
                autoCorrect={false}
                style={styles.dateInput}
              />

            </View>

            {savedBook?.status ===
              'read' ||
            savedBook?.status ===
              'dnf' ? (
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>
                  {savedBook.status ===
                  'read'
                    ? 'Finished'
                    : 'Stopped'}
                </Text>

                <TextInput
                  value={endedDateInput}
                  onChangeText={(value) =>
                    setEndedDateInput(
                      formatDateInput(
                        value,
                        endedDateInput
                      )
                    )
                  }
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={
                    COLORS.mutedText
                  }
                  keyboardType="number-pad"
                  maxLength={10}
                  autoCorrect={false}
                  style={styles.dateInput}
                />
              </View>
            ) : null}

            <View style={styles.dateModalActions}>
              <Pressable
                onPress={
                  closeReadingDateEditor
                }
                disabled={savingDates}
                style={({ pressed }) => [
                  styles.dateCancelButton,
                  pressed &&
                    styles.dateActionPressed,
                ]}
              >
                <Text style={styles.dateCancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={
                  saveReadingDates
                }
                disabled={savingDates}
                style={({ pressed }) => [
                  styles.dateSaveButton,
                  pressed &&
                    styles.dateActionPressed,
                  savingDates &&
                    styles.dateSaveButtonDisabled,
                ]}
              >
                {savingDates ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.background}
                  />
                ) : (
                  <Text style={styles.dateSaveText}>
                    Save Dates
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    marginTop: 14,
  },

  topBar: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 10,
  },

  backText: {
    color: COLORS.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    marginLeft: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  hero: {
    alignItems: 'center',
    paddingTop: 12,
  },

  cover: {
    width: 155,
    height: 232,
    borderRadius: 10,
    backgroundColor: COLORS.elevated,
  },

  coverPlaceholder: {
    width: 155,
    height: 232,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noCoverText: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 8,
  },

  title: {
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 37,
    textAlign: 'center',
    marginTop: 24,
  },

  subtitle: {
    color: COLORS.secondaryText,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    textAlign: 'center',
    marginTop: 5,
  },

  author: {
    color: COLORS.softGold,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
  },

  seriesBadge: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },

  seriesBadgeText: {
    color: COLORS.gold,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },

  statusSection: {
    marginTop: 30,
  },

  statusHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  statusHeading: {
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
  },

  statusSubheading: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  sectionLabel: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 11,
  },

  statusGrid: {
    flexDirection: 'row',
    gap: 7,
  },

  statusButton: {
    flex: 1,
    minHeight: 74,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 9,
  },

  statusButtonSelected: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.gold,
    borderWidth: 1.5,
  },

  statusButtonPressed: {
    opacity: 0.72,
  },

  statusButtonDisabled: {
    opacity: 0.42,
  },

  statusIconWrap: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  statusIconWrapSelected: {
    backgroundColor: COLORS.background,
  },

  statusButtonText: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },

  statusButtonTextSelected: {
    color: COLORS.softGold,
  },

  statusFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    marginTop: 7,
  },

  savedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusConfirmation: {
    color: COLORS.softGold,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginLeft: 5,
  },

  removeLibraryIconButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeLibraryIconButtonPressed: {
    backgroundColor: COLORS.elevated,
  },

  removeLibraryIconButtonDisabled: {
    opacity: 0.4,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 28,
  },

  readingDatesSection: {
    marginTop: 21,
  },

  readingDatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  editDatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginTop: -3,
  },

  editDatesButtonPressed: {
    backgroundColor: COLORS.elevated,
  },

  editDatesText: {
    color: COLORS.gold,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    marginLeft: 4,
  },

  readingDatesCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    minHeight: 52,
    paddingHorizontal: 5,
  },

  readingDateCompactItem: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  readingDateLabel: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
  },

  readingDateValue: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 2,
  },

  readingDateVerticalDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 9,
  },

  dateModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },

  dateModalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 18,
  },

  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 19,
  },

  dateModalHeaderText: {
    flex: 1,
    marginRight: 12,
  },

  dateModalTitle: {
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 21,
  },

  dateModalSubtitle: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  dateModalClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateModalClosePressed: {
    backgroundColor: COLORS.elevated,
  },

  dateField: {
    marginBottom: 15,
  },

  dateFieldLabel: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    marginBottom: 7,
  },

  dateInput: {
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    paddingHorizontal: 13,
  },

  dateModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    marginTop: 2,
  },

  dateCancelButton: {
    minWidth: 88,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  dateSaveButton: {
    minWidth: 110,
    height: 42,
    borderRadius: 11,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  dateSaveButtonDisabled: {
    opacity: 0.55,
  },

  dateActionPressed: {
    opacity: 0.72,
  },

  dateCancelText: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },

  dateSaveText: {
    color: COLORS.background,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },

  detailsSection: {
    marginTop: 24,
  },

  metadataCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    padding: 15,
  },

  metadataTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  metadataStat: {
    flex: 1,
    alignItems: 'center',
    minHeight: 76,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  metadataIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  metadataVerticalDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },

  metadataHorizontalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 13,
  },

  metadataLabel: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.25,
  },

  metadataStatValue: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },

  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  genreIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  genreTextWrap: {
    flex: 1,
  },

  genreValue: {
    color: COLORS.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },

  seriesSection: {
    marginTop: 30,
  },

  seriesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  seriesLoadingText: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginLeft: 10,
  },

  seriesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
  },

  seriesTogglePressed: {
    opacity: 0.72,
  },

  seriesToggleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  seriesToggleText: {
    flex: 1,
    marginRight: 10,
  },

  seriesToggleName: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },

  seriesToggleMeta: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 4,
  },

  seriesCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
  },

  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  seriesRowLast: {
    borderBottomWidth: 0,
  },

  seriesRowPressed: {
    opacity: 0.65,
  },

  seriesCover: {
    width: 46,
    height: 69,
    borderRadius: 5,
    backgroundColor: COLORS.elevated,
    marginRight: 12,
  },

  seriesCoverPlaceholder: {
    width: 46,
    height: 69,
    borderRadius: 5,
    backgroundColor: COLORS.elevated,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  seriesBookText: {
    flex: 1,
    marginRight: 8,
  },

  seriesTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  seriesNumber: {
    color: COLORS.gold,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    marginRight: 6,
    marginTop: 1,
  },

  seriesBookTitle: {
    flex: 1,
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 19,
  },

  seriesBookTitleCurrent: {
    color: COLORS.softGold,
  },

  seriesBookTitleUnavailable: {
    color: COLORS.mutedText,
    fontStyle: 'italic',
  },

  seriesBookMeta: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 5,
  },

  currentBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  currentBookLabel: {
    color: COLORS.softGold,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginLeft: 4,
  },

  descriptionSection: {
    marginTop: 30,
  },

  sectionHeading: {
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 25,
    marginBottom: 12,
  },

  description: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 24,
  },

  noDescription: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },

  readMore: {
    color: COLORS.gold,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 10,
  },

  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 17,
    marginTop: 32,
  },

  communityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  communityText: {
    flex: 1,
    marginLeft: 13,
    marginRight: 10,
  },

  communityTitle: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },

  communityDescription: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  errorTitle: {
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 25,
  },

  errorText: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  backButtonLarge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },

  backButtonLargeText: {
    color: COLORS.background,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
});
