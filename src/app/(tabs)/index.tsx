import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  KeyboardStickyView,
  useKeyboardAnimation,
} from 'react-native-keyboard-controller';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import BlockReaderConfirmSheet from '../../components/BlockReaderConfirmSheet';
import {
  CLUB_GENRES,
  ClubGenreKey,
  getClubGenreLabel,
} from '../../constants/club-genres';
import { COLORS } from '../../constants/novori-theme';
import {
  ClubWithMembership,
  getDiscoverClubs,
  getMyClubs,
  searchClubs,
} from '../../lib/clubs';
import {
  CommentVoteValue,
  createPostComment,
  deletePostComment,
  getPostComments,
  PostComment,
  toggleCommentVote,
  updatePostComment,
} from '../../lib/comments';
import {
  containsExplicitLanguage,
  getExplicitLanguagePreference,
  isExplicitContentRevealed,
  revealExplicitContentOnce,
  setExplicitLanguagePreference,
} from '../../lib/content-filter';
import {
  deletePost,
  FeedPost,
  getHomeFeed,
  PostVoteValue,
  togglePostVote,
} from '../../lib/feed';
import {
  getNotificationAttentionCount,
} from '../../lib/notifications';
import {
  ReportReason,
  submitCommentReport,
  submitPostReport,
} from '../../lib/reports';
import {
  blockReader,
} from '../../lib/social';
import {
  supabase,
} from '../../lib/supabase';

type HomeSection =
  | 'feed'
  | 'clubs';

type ComposerProfile = {
  display_name:
    string | null;
  username:
    string | null;
  avatar_url:
    string | null;
};

const POST_REPORT_REASONS:
  Array<{
    value: ReportReason;
    label: string;
    icon:
      keyof typeof Ionicons.glyphMap;
  }> = [
    {
      value:
        'explicit_content',
      label:
        'Graphic or inappropriate content',
      icon:
        'eye-off-outline',
    },
    {
      value:
        'hate',
      label:
        'Violence, hate, or discrimination',
      icon:
        'warning-outline',
    },
    {
      value:
        'harassment',
      label:
        'Bullying or unwanted contact',
      icon:
        'person-remove-outline',
    },
    {
      value:
        'spam',
      label:
        'Scam, fraud, or spam',
      icon:
        'megaphone-outline',
    },
    {
      value:
        'impersonation',
      label:
        'Impersonation',
      icon:
        'people-outline',
    },
    {
      value:
        'other',
      label:
        'Other',
      icon:
        'ellipsis-horizontal-circle-outline',
    },
  ];


type ReadingUpdateDisplay = {
  pageLabel: string | null;
  chapterLabel: string | null;
  thought: string;
};

function parseReadingUpdateDisplay(
  body: string
): ReadingUpdateDisplay {
  const normalized =
    body.replace(
      /\r\n/g,
      '\n'
    );

  const [
    firstBlock,
    ...restBlocks
  ] =
    normalized.split(
      /\n\s*\n/
    );

  const pieces =
    firstBlock
      .split('·')
      .map(
        (piece) =>
          piece.trim()
      )
      .filter(
        Boolean
      );

  let pageLabel:
    string | null =
    null;

  let chapterLabel:
    string | null =
    null;

  let recognizedProgress =
    false;

  for (
    const piece of
    pieces
  ) {
    if (
      /^Page\s+\d+$/i.test(
        piece
      ) ||
      /^\d+(?:\.\d+)?%$/.test(
        piece
      )
    ) {
      pageLabel =
        piece;
      recognizedProgress =
        true;
      continue;
    }

    if (
      /^Chapter\s+.+$/i.test(
        piece
      )
    ) {
      chapterLabel =
        piece;
      recognizedProgress =
        true;
    }
  }

  const thought =
    recognizedProgress
      ? restBlocks
          .join(
            '\n\n'
          )
          .trim()
      : normalized.trim();

  return {
    pageLabel,
    chapterLabel,
    thought,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    height:
      keyboardHeight,
  } =
    useKeyboardAnimation();

  const emptyStateKeyboardTranslateY =
    Animated.multiply(
      keyboardHeight,
      0.5
    );
  const {
    height: windowHeight,
  } = useWindowDimensions();

  const commentsFullHeight =
    Math.max(
      320,
      windowHeight -
        insets.top
    );

  const commentsPartialHeight =
    Math.max(
      360,
      Math.round(
        windowHeight * 0.82
      )
    );

  const commentsEntranceStartHeight =
    Math.max(
      320,
      Math.round(
        windowHeight * 0.50
      )
    );

  const [activeSection, setActiveSection] =
    useState<HomeSection>('feed');

  const [
    attentionCount,
    setAttentionCount,
  ] = useState(0);

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    reportTargetPost,
    setReportTargetPost,
  ] =
    useState<FeedPost | null>(
      null
    );

  const [
    reportSubmitting,
    setReportSubmitting,
  ] =
    useState(false);

  // Keep the sheet fully offscreen until the native modal is presented.
  const reportEntranceOffset = windowHeight + 80;

  const reportTranslateY =
    useRef(
      new Animated.Value(
        reportEntranceOffset
      )
    ).current;

  const reportBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const reportSheetAnimating =
    useRef(false);
  const reportSheetOpacity = useRef(new Animated.Value(0)).current;
  const reportSheetHeight = useRef(0);
  const reportModalShown = useRef(false);
  const reportEntranceStarted = useRef(false);
  const reportSheetClosing = useRef(false);
  const reportSubmitted = useRef(false);

  const [
    composerProfile,
    setComposerProfile,
  ] =
    useState<ComposerProfile | null>(
      null
    );

  const [
    myClubs,
    setMyClubs,
  ] =
    useState<ClubWithMembership[]>([]);

  const [
    discoverClubs,
    setDiscoverClubs,
  ] =
    useState<ClubWithMembership[]>([]);

  const [
    clubsLoading,
    setClubsLoading,
  ] =
    useState(true);

  const [
    feedPosts,
    setFeedPosts,
  ] =
    useState<FeedPost[]>([]);

  const [
    feedLoading,
    setFeedLoading,
  ] =
    useState(true);

  const [
    feedError,
    setFeedError,
  ] =
    useState('');

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    allowExplicitLanguage,
    setAllowExplicitLanguage,
  ] =
    useState(false);

  const [
    revealedExplicitPosts,
    setRevealedExplicitPosts,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});

  const [
    revealedExplicitComments,
    setRevealedExplicitComments,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});

  const [
    votingPostId,
    setVotingPostId,
  ] =
    useState<
      string | null
    >(null);

  const [
    deletingPostId,
    setDeletingPostId,
  ] =
    useState<
      string | null
    >(null);

  const [
    ownPostOptionsTarget,
    setOwnPostOptionsTarget,
  ] =
    useState<FeedPost | null>(
      null
    );

  const ownPostOptionsTranslateY =
    useRef(
      new Animated.Value(
        12
      )
    ).current;

  const ownPostOptionsSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const ownPostOptionsBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const [
    commentsPost,
    setCommentsPost,
  ] =
    useState<
      FeedPost | null
    >(null);

  const [
    commentsModalVisible,
    setCommentsModalVisible,
  ] =
    useState(false);

  const [
    sheetComments,
    setSheetComments,
  ] =
    useState<
      PostComment[]
    >([]);

  const [
    commentsLoading,
    setCommentsLoading,
  ] =
    useState(false);

  const [
    commentsInitialLoadReady,
    setCommentsInitialLoadReady,
  ] =
    useState(false);

  const [
    commentsSheetEntranceReady,
    setCommentsSheetEntranceReady,
  ] =
    useState(false);

  const [
    commentsKeyboardVisible,
    setCommentsKeyboardVisible,
  ] =
    useState(false);

  const [
    commentBody,
    setCommentBody,
  ] =
    useState('');

  const [
    composerResetting,
    setComposerResetting,
  ] =
    useState(false);

  const [
    replyResetting,
    setReplyResetting,
  ] =
    useState(false);

  const [
    replyTarget,
    setReplyTarget,
  ] =
    useState<
      PostComment | null
    >(null);

  const [
    submittingComment,
    setSubmittingComment,
  ] =
    useState(false);

  const [
    deletingCommentId,
    setDeletingCommentId,
  ] =
    useState<
      string | null
    >(null);

  const [
    commentReportTarget,
    setCommentReportTarget,
  ] =
    useState<PostComment | null>(
      null
    );

  const [
    commentActionTarget,
    setCommentActionTarget,
  ] =
    useState<PostComment | null>(
      null
    );

  const [
    blockConfirmTarget,
    setBlockConfirmTarget,
  ] =
    useState<PostComment | null>(
      null
    );

  const blockedReaderAfterDismiss = useRef<string | null>(null);

  const [
    holdingCommentId,
    setHoldingCommentId,
  ] =
    useState<string | null>(
      null
    );

  const commentActionTranslateY =
    useRef(
      new Animated.Value(
        12
      )
    ).current;

  const commentActionBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentActionSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentSelectionAccentOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentActionSheetHeight =
    useRef(
      0
    );

  const commentActionEntranceStarted =
    useRef(false);

  const commentActionClosing =
    useRef(false);

  const pendingCommentActionHandoff =
    useRef<
      (() => void) | null
    >(null);


  const [
    editingComment,
    setEditingComment,
  ] =
    useState<PostComment | null>(
      null
    );

  const [
    blockingReaderId,
    setBlockingReaderId,
  ] =
    useState<string | null>(
      null
    );

  const [
    commentReportSubmitting,
    setCommentReportSubmitting,
  ] =
    useState(false);

  const commentReportTranslateY =
    useRef(
      new Animated.Value(
        windowHeight + 80
      )
    ).current;

  const commentReportBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentReportSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentReportSheetHeight =
    useRef(0);

  const commentReportSheetAnimating =
    useRef(false);

  const commentReportSheetClosing =
    useRef(false);

  const commentReportEntranceStarted =
    useRef(false);

  const [
    expandedReplyThreads,
    setExpandedReplyThreads,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});

  const [
    commentSort,
    setCommentSort,
  ] =
    useState<
      'top' | 'newest'
    >('top');

  const [
    votingCommentIds,
    setVotingCommentIds,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});

  const commentInputRef =
    useRef<TextInput>(
      null
    );

  const commentsSheetHeight =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentsEntranceTranslateY =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentsBackdropOpacity =
    useRef(
      new Animated.Value(
        1
      )
    ).current;


  const commentsEmptyOpacity =
    useRef(
      new Animated.Value(
        1
      )
    ).current;

  const commentsContentOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentsResultOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const commentsSheetCurrentHeight =
    useRef(
      0
    );

  const commentsSheetGestureStartHeight =
    useRef(
      0
    );

  const commentsSheetSnap =
    useRef<
      'partial' | 'full'
    >('partial');

  const commentsSheetAnimating =
    useRef(false);

  const commentsKeyboardGestureLock =
    useRef(false);

  const preserveHomeStateOnNextBlur =
    useRef(false);

  const [
    clubSearch,
    setClubSearch,
  ] =
    useState('');

  const [
    clubSearchResults,
    setClubSearchResults,
  ] =
    useState<ClubWithMembership[]>([]);

  const [
    clubSearchLoading,
    setClubSearchLoading,
  ] =
    useState(false);

  const [
    clubSearchError,
    setClubSearchError,
  ] =
    useState('');

  const [
    activeClubGenre,
    setActiveClubGenre,
  ] =
    useState<
      ClubGenreKey | 'all'
    >('all');

  const loadComposerProfile =
    useCallback(
      async () => {
        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          return;
        }

        setCurrentUserId(
          user.id
        );

        const {
          data,
          error,
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

        if (error) {
          console.error(
            'Could not load comment composer profile:',
            error.message
          );
          return;
        }

        setComposerProfile(
          data
        );
      },
      []
    );

  const loadHomeData =
    useCallback(
      async (
        showClubLoader =
          false
      ) => {
        if (showClubLoader) {
          setClubsLoading(true);
          setFeedLoading(true);
        }

        const results =
          await Promise.allSettled([
            getNotificationAttentionCount(),
            getMyClubs(),
            getDiscoverClubs(),
            getHomeFeed(),
            getExplicitLanguagePreference(),
          ]);

        const [
          attentionResult,
          myClubsResult,
          discoverResult,
          feedResult,
          explicitPreferenceResult,
        ] = results;

        if (
          attentionResult.status ===
          'fulfilled'
        ) {
          setAttentionCount(
            attentionResult.value
          );
        } else {
          console.error(
            'Could not load notification attention count:',
            attentionResult.reason
          );
        }

        if (
          myClubsResult.status ===
          'fulfilled'
        ) {
          setMyClubs(
            myClubsResult.value
          );
        } else {
          console.error(
            'Could not load your clubs:',
            myClubsResult.reason
          );
        }

        if (
          discoverResult.status ===
          'fulfilled'
        ) {
          setDiscoverClubs(
            discoverResult.value
          );
        } else {
          console.error(
            'Could not load discover clubs:',
            discoverResult.reason
          );
        }

        if (
          feedResult.status ===
          'fulfilled'
        ) {
          setFeedPosts(
            feedResult.value
          );
          setFeedError(
            ''
          );
        } else {
          console.error(
            'Could not load Home feed:',
            feedResult.reason
          );
          setFeedError(
            'Could not load your feed.'
          );
        }

        if (
          explicitPreferenceResult.status ===
          'fulfilled'
        ) {
          setAllowExplicitLanguage(
            explicitPreferenceResult.value
          );
        } else {
          console.error(
            'Could not load explicit-language preference:',
            explicitPreferenceResult.reason
          );
        }

        if (showClubLoader) {
          setClubsLoading(false);
          setFeedLoading(false);
        }
      },
      []
    );

  useEffect(
    () => {
      if (
        commentActionTarget ||
        !pendingCommentActionHandoff.current
      ) {
        return;
      }

      const action =
        pendingCommentActionHandoff.current;

      pendingCommentActionHandoff.current =
        null;

      // Effects run after React has committed the action-sheet unmount.
      // The action can now safely update/focus the composer without the
      // keyboard ever re-laying out a still-mounted action sheet.
      action();
    },
    [
      commentActionTarget,
    ]
  );

  useEffect(
    () => {
      if (
        Platform.OS !==
        'ios'
      ) {
        return;
      }

      const changeFrame =
        Keyboard.addListener(
          'keyboardWillChangeFrame',
          (
            event
          ) => {
            const overlap =
              Math.max(
                0,
                windowHeight -
                  event.endCoordinates
                    .screenY
              );

            setCommentsKeyboardVisible(
              overlap >
                0
            );

            if (
              overlap ===
              0
            ) {
              setComposerResetting(
                false
              );

              setReplyResetting(
                false
              );
            }
          }
        );

      return () => {
        changeFrame.remove();
      };
    },
    [
      windowHeight,
    ]
  );

  useEffect(
    () => {
      if (
        !commentsModalVisible ||
        !commentsInitialLoadReady
      ) {
        return;
      }

      commentsResultOpacity.stopAnimation();
      commentsResultOpacity.setValue(
        0
      );

      Animated.timing(
        commentsResultOpacity,
        {
          toValue:
            1,
          duration:
            60,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ).start();
    },
    [
      commentsInitialLoadReady,
      commentsModalVisible,
      commentsResultOpacity,
    ]
  );

  useEffect(() => {
    const normalized =
      clubSearch.trim();

    if (!normalized) {
      setClubSearchResults(
        []
      );

      setClubSearchError(
        ''
      );

      setClubSearchLoading(
        false
      );

      return;
    }

    let active =
      true;

    const timer =
      setTimeout(
        async () => {
          try {
            setClubSearchLoading(
              true
            );

            setClubSearchError(
              ''
            );

            const results =
              await searchClubs(
                normalized
              );

            if (
              active
            ) {
              setClubSearchResults(
                results
              );
            }
          } catch (
            error
          ) {
            console.error(
              'Could not search clubs:',
              error
            );

            if (
              active
            ) {
              setClubSearchResults(
                []
              );

              setClubSearchError(
                'Could not search clubs.'
              );
            }
          } finally {
            if (
              active
            ) {
              setClubSearchLoading(
                false
              );
            }
          }
        },
        300
      );

    return () => {
      active =
        false;

      clearTimeout(
        timer
      );
    };
  }, [
    clubSearch,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (
        preserveHomeStateOnNextBlur.current
      ) {
        preserveHomeStateOnNextBlur.current =
          false;

        return () => {
          Keyboard.dismiss();
        };
      }

      loadHomeData(true);
      void loadComposerProfile();

      return () => {
        Keyboard.dismiss();

        if (
          preserveHomeStateOnNextBlur.current
        ) {
          return;
        }

        setActiveSection(
          'feed'
        );

        setClubSearch(
          ''
        );

        setClubSearchResults(
          []
        );

        setClubSearchLoading(
          false
        );

        setClubSearchError(
          ''
        );
      };
    }, [
      loadHomeData,
      loadComposerProfile,
    ])
  );

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await loadHomeData(false);
    } finally {
      setRefreshing(false);
    }
  }

  function openClub(
    clubId: string
  ) {
    preserveHomeStateOnNextBlur.current =
      true;

    router.push({
      pathname:
        '/club/[id]',
      params: {
        id: clubId,
      },
    });
  }

  function openReader(
    readerId: string
  ) {
    router.push({
      pathname:
        '/reader/[id]',
      params: {
        id:
          readerId,
      },
    });
  }

  function openBook(
    googleBookId: string
  ) {
    preserveHomeStateOnNextBlur.current =
      true;

    router.push({
      pathname:
        '/book/[id]',
      params: {
        id:
          googleBookId,
      },
    });
  }

  async function loadCommentsSheet(
    postId: string
  ) {
    try {
      setCommentsLoading(
        true
      );

      const comments =
        await getPostComments(
          postId
        );

      setSheetComments(
        comments
      );

      setFeedPosts(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              postId
                ? {
                    ...item,
                    comment_count:
                      comments.length,
                  }
                : item
          )
      );

      setCommentsPost(
        (
          current
        ) =>
          current?.id ===
          postId
            ? {
                ...current,
                comment_count:
                  comments.length,
              }
            : current
      );
    } catch (
      error
    ) {
      console.error(
        'Could not load comments:',
        error
      );

      Alert.alert(
        'Could not load comments',
        'Please try again.'
      );
    } finally {
      setCommentsLoading(
        false
      );

      setCommentsInitialLoadReady(
        true
      );
    }
  }

  function openCommentsSheet(
    post: FeedPost
  ) {
    commentsSheetHeight.stopAnimation();
    commentsEntranceTranslateY.stopAnimation();
    commentsBackdropOpacity.stopAnimation();
    commentsContentOpacity.stopAnimation();
    commentsResultOpacity.stopAnimation();
    commentsEmptyOpacity.stopAnimation();

    commentsResultOpacity.setValue(
      0
    );
    commentsEmptyOpacity.setValue(
      1
    );

    setCommentsInitialLoadReady(
      false
    );
    setCommentsSheetEntranceReady(
      false
    );
    setCommentsKeyboardVisible(
      false
    );

    // The sheet is already at its final resting height.
    // Only the outer entrance wrapper moves, so the opening
    // animation never performs JS-thread layout work.
    commentsSheetHeight.setValue(
      commentsPartialHeight
    );

    commentsEntranceTranslateY.setValue(
      Math.max(
        0,
        commentsPartialHeight -
          commentsEntranceStartHeight
      )
    );
    commentsBackdropOpacity.setValue(
      0
    );
    commentsContentOpacity.setValue(
      0
    );

    commentsSheetCurrentHeight.current =
      commentsPartialHeight;
    commentsSheetGestureStartHeight.current =
      commentsPartialHeight;
    commentsSheetSnap.current =
      'partial';
    commentsSheetAnimating.current =
      true;

    setSheetComments(
      []
    );

    setCommentBody(
      ''
    );

    setReplyTarget(
      null
    );

    setEditingComment(
      null
    );

    setCommentActionTarget(
      null
    );

    setExpandedReplyThreads(
      {}
    );

    setCommentSort(
      'top'
    );

    setCommentsPost(
      post
    );

    setCommentsModalVisible(
      true
    );

    void loadCommentsSheet(
      post.id
    );
  }

  function animateCommentsSheetIn() {
    commentsEntranceTranslateY.stopAnimation();
    commentsBackdropOpacity.stopAnimation();
    commentsContentOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(
        commentsEntranceTranslateY,
        {
          toValue:
            0,
          duration:
            285,
          easing:
            Easing.bezier(
              0.22,
              1,
              0.36,
              1
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentsBackdropOpacity,
        {
          toValue:
            1,
          duration:
            180,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentsContentOpacity,
        {
          toValue:
            1,
          duration:
            65,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      commentsSheetAnimating.current =
        false;

      if (finished) {
        commentsSheetCurrentHeight.current =
          commentsPartialHeight;
        commentsSheetGestureStartHeight.current =
          commentsPartialHeight;

        setCommentsSheetEntranceReady(
          true
        );
      }
    });
  }

  function handleCommentsModalDismiss() {
    commentsResultOpacity.stopAnimation();
    commentsEmptyOpacity.stopAnimation();
    commentsResultOpacity.setValue(
      0
    );
    commentsEmptyOpacity.setValue(
      1
    );

    setCommentsInitialLoadReady(
      false
    );
    setCommentsSheetEntranceReady(
      false
    );
    setCommentsKeyboardVisible(
      false
    );

    commentsSheetAnimating.current =
      false;
    commentsSheetSnap.current =
      'partial';
    commentsSheetCurrentHeight.current =
      0;
    commentsSheetGestureStartHeight.current =
      0;

    commentsSheetHeight.setValue(
      0
    );
    commentsEntranceTranslateY.setValue(
      0
    );
    commentsBackdropOpacity.setValue(
      0
    );
    commentsContentOpacity.setValue(
      0
    );

    setCommentsPost(
      null
    );

    setSheetComments(
      []
    );

    setCommentBody(
      ''
    );

    setReplyTarget(
      null
    );

    setEditingComment(
      null
    );

    setCommentActionTarget(
      null
    );

    setExpandedReplyThreads(
      {}
    );
  }

  function snapCommentsSheet(
    target:
      'partial' | 'full'
  ) {
    const targetHeight =
      target ===
        'full'
        ? commentsFullHeight
        : commentsPartialHeight;

    commentsSheetSnap.current =
      target;
    commentsSheetAnimating.current =
      true;

    commentsSheetHeight.stopAnimation();

    Animated.timing(
      commentsSheetHeight,
      {
        toValue:
          targetHeight,
        duration:
          target ===
            'full'
            ? 235
            : 220,
        easing:
          Easing.bezier(
            0.22,
            1,
            0.36,
            1
          ),
        useNativeDriver:
          false,
      }
    ).start(({
      finished,
    }) => {
      commentsSheetAnimating.current =
        false;

      if (finished) {
        commentsSheetCurrentHeight.current =
          targetHeight;
        commentsSheetGestureStartHeight.current =
          targetHeight;
      }
    });
  }

  function handleCommentsBackdropPress() {
    if (
      editingComment ||
      replyTarget
    ) {
      resetTemporaryCommentComposer();
      return;
    }

    if (
      commentsKeyboardVisible
    ) {
      Keyboard.dismiss();
      return;
    }

    closeCommentsSheet();
  }

  function closeCommentsSheet(
    force =
      false
  ) {
    if (
      commentsSheetAnimating.current &&
      !force
    ) {
      return;
    }

    Keyboard.dismiss();

    commentsSheetAnimating.current =
      true;

    commentsSheetHeight.stopAnimation();
    commentsBackdropOpacity.stopAnimation();
    commentsContentOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(
        commentsSheetHeight,
        {
          toValue:
            0,
          duration:
            235,
          easing:
            Easing.bezier(
              0.32,
              0,
              0.67,
              1
            ),
          useNativeDriver:
            false,
        }
      ),
      Animated.timing(
        commentsBackdropOpacity,
        {
          toValue:
            0,
          duration:
            210,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentsContentOpacity,
        {
          toValue:
            0,
          duration:
            90,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      if (!finished) {
        commentsSheetAnimating.current =
          false;
        return;
      }

      commentsSheetCurrentHeight.current =
        0;
      commentsSheetGestureStartHeight.current =
        0;

      setCommentsModalVisible(
        false
      );
    });
  }

  const commentsSheetPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () =>
              !commentsSheetAnimating.current,

          onStartShouldSetPanResponderCapture:
            () =>
              !commentsSheetAnimating.current,

          onMoveShouldSetPanResponder:
            () =>
              !commentsSheetAnimating.current,

          onMoveShouldSetPanResponderCapture:
            () =>
              !commentsSheetAnimating.current,

          onPanResponderGrant:
            () => {
              commentsKeyboardGestureLock.current =
                commentsKeyboardVisible;

              if (
                commentsKeyboardGestureLock.current
              ) {
                Keyboard.dismiss();

                const lockedHeight =
                  commentsSheetSnap.current ===
                  'full'
                    ? commentsFullHeight
                    : commentsPartialHeight;

                commentsSheetHeight.stopAnimation();
                commentsSheetHeight.setValue(
                  lockedHeight
                );

                commentsSheetCurrentHeight.current =
                  lockedHeight;
                commentsSheetGestureStartHeight.current =
                  lockedHeight;

                return;
              }

              commentsSheetHeight.stopAnimation(
                (
                  value
                ) => {
                  commentsSheetCurrentHeight.current =
                    value;
                  commentsSheetGestureStartHeight.current =
                    value;
                }
              );

              commentsSheetGestureStartHeight.current =
                commentsSheetCurrentHeight.current;

            },

          onPanResponderMove: (
            _event,
            gesture
          ) => {
            if (
              commentsKeyboardGestureLock.current
            ) {
              return;
            }

            const nextHeight =
              Math.max(
                0,
                Math.min(
                  commentsFullHeight,
                  commentsSheetGestureStartHeight.current -
                    gesture.dy
                )
              );

            commentsSheetCurrentHeight.current =
              nextHeight;

            commentsSheetHeight.setValue(
              nextHeight
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              commentsKeyboardGestureLock.current
            ) {
              commentsKeyboardGestureLock.current =
                false;

              snapCommentsSheet(
                commentsSheetSnap.current
              );
              return;
            }

            const currentSnap =
              commentsSheetSnap.current;

            const currentHeight =
              commentsSheetCurrentHeight.current;

            const fullToPartialMidpoint =
              commentsPartialHeight +
              (
                commentsFullHeight -
                commentsPartialHeight
              ) *
                0.52;

            const partialDismissThreshold =
              commentsPartialHeight *
              0.68;

            // Keyboard dismissal is independent of sheet snapping.
            // The sheet still always resolves to a valid resting point.
            if (
              commentsKeyboardVisible
            ) {
              Keyboard.dismiss();
            }

            if (
              currentSnap ===
              'full'
            ) {
              const shouldDismissFromFull =
                currentHeight <=
                  partialDismissThreshold ||
                gesture.dy >
                  220 ||
                gesture.vy >
                  1.05;

              if (
                shouldDismissFromFull
              ) {
                closeCommentsSheet();
                return;
              }

              const shouldReturnPartial =
                currentHeight <=
                  fullToPartialMidpoint ||
                gesture.dy >
                  56 ||
                gesture.vy >
                  0.42;

              if (
                shouldReturnPartial
              ) {
                snapCommentsSheet(
                  'partial'
                );
                return;
              }

              snapCommentsSheet(
                'full'
              );
              return;
            }

            const shouldDismiss =
              currentHeight <=
                partialDismissThreshold ||
              gesture.dy >
                118 ||
              gesture.vy >
                0.92;

            if (
              shouldDismiss
            ) {
              closeCommentsSheet();
              return;
            }

            const shouldExpand =
              currentHeight >=
                fullToPartialMidpoint ||
              gesture.dy <
                -42 ||
              gesture.vy <
                -0.38;

            if (
              shouldExpand
            ) {
              snapCommentsSheet(
                'full'
              );
              return;
            }

            snapCommentsSheet(
              'partial'
            );
          },

          onPanResponderTerminationRequest:
            () => false,

          onPanResponderTerminate:
            () => {
              if (
                commentsKeyboardGestureLock.current
              ) {
                commentsKeyboardGestureLock.current =
                  false;

                snapCommentsSheet(
                  commentsSheetSnap.current
                );
                return;
              }

              const distanceToPartial =
                Math.abs(
                  commentsSheetCurrentHeight.current -
                    commentsPartialHeight
                );

              const distanceToFull =
                Math.abs(
                  commentsSheetCurrentHeight.current -
                    commentsFullHeight
                );

              snapCommentsSheet(
                distanceToFull <
                  distanceToPartial
                  ? 'full'
                  : 'partial'
              );
            },

          onShouldBlockNativeResponder:
            () => true,
        }),
      [
        commentsFullHeight,
        commentsKeyboardVisible,
        commentsPartialHeight,
        commentsSheetHeight,
      ]
    );

  function startComposerWithKeyboard(
    action:
      () => void
  ) {
    setComposerResetting(
      false
    );

    setReplyResetting(
      false
    );

    action();

    requestAnimationFrame(
      () => {
        commentInputRef
          .current
          ?.focus();
      }
    );
  }

  function startReply(
    comment:
      PostComment
  ) {
    startComposerWithKeyboard(
      () => {
        setEditingComment(
          null
        );

        setCommentBody(
          ''
        );

        setReplyTarget(
          comment
        );
      }
    );
  }

  function toggleReplies(
    commentId: string
  ) {
    setExpandedReplyThreads(
      (
        current
      ) => ({
        ...current,
        [commentId]:
          !current[
            commentId
          ],
      })
    );
  }

  async function submitSheetComment() {
    if (
      !commentsPost ||
      submittingComment
    ) {
      return;
    }

    const cleaned =
      commentBody.trim();

    if (
      !cleaned
    ) {
      return;
    }

    if (
      editingComment
    ) {
      const target =
        editingComment;

      const previousBody =
        target.body;

      setSubmittingComment(
        true
      );

      setSheetComments(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              target.id
                ? {
                    ...item,
                    body:
                      cleaned,
                    updated_at:
                      new Date().toISOString(),
                  }
                : item
          )
      );

      setEditingComment(
        null
      );

      setCommentBody(
        ''
      );

      try {
        await updatePostComment(
          target.id,
          cleaned
        );
      } catch (
        error
      ) {
        console.error(
          'Could not edit comment:',
          error
        );

        setSheetComments(
          (
            current
          ) =>
            current.map(
              (
                item
              ) =>
                item.id ===
                target.id
                  ? {
                      ...item,
                      body:
                        previousBody,
                    }
                  : item
            )
        );

        setEditingComment(
          target
        );

        setCommentBody(
          cleaned
        );

        Alert.alert(
          'Could not edit comment',
          error instanceof Error
            ? error.message
            : 'Please try again.'
        );
      } finally {
        setSubmittingComment(
          false
        );
      }

      return;
    }

    const postId =
      commentsPost.id;

    const parentId =
      replyTarget?.id ??
      null;

    const optimisticId =
      `optimistic-${Date.now()}`;

    const optimisticComment:
      PostComment = {
        id:
          optimisticId,
        post_id:
          postId,
        author_id:
          'optimistic-current-user',
        parent_comment_id:
          parentId,
        body:
          cleaned,
        created_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
        author_display_name:
          'You',
        author_username:
          null,
        author_avatar_url:
          null,
        is_own:
          true,
        upvote_count:
          0,
        downvote_count:
          0,
        vote_score:
          0,
        viewer_vote:
          0,
      };

    const previousBody =
      commentBody;

    const previousReplyTarget =
      replyTarget;

    setSheetComments(
      (
        current
      ) => [
        ...current,
        optimisticComment,
      ]
    );

    setFeedPosts(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            postId
              ? {
                  ...item,
                  comment_count:
                    (
                      item.comment_count ??
                      0
                    ) +
                    1,
                }
              : item
        )
    );

    setCommentsPost(
      (
        current
      ) =>
        current?.id ===
        postId
          ? {
              ...current,
              comment_count:
                (
                  current.comment_count ??
                  0
                ) +
                1,
            }
          : current
    );

    setCommentBody(
      ''
    );

    setReplyTarget(
      null
    );

    try {
      setSubmittingComment(
        true
      );

      await createPostComment(
        postId,
        cleaned,
        parentId
      );

      const comments =
        await getPostComments(
          postId
        );

      setSheetComments(
        comments
      );

      setFeedPosts(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              postId
                ? {
                    ...item,
                    comment_count:
                      comments.length,
                  }
                : item
          )
      );

      setCommentsPost(
        (
          current
        ) =>
          current?.id ===
          postId
            ? {
                ...current,
                comment_count:
                  comments.length,
              }
            : current
      );
    } catch (
      error
    ) {
      console.error(
        'Could not add comment:',
        error
      );

      setSheetComments(
        (
          current
        ) =>
          current.filter(
            (
              comment
            ) =>
              comment.id !==
              optimisticId
          )
      );

      setFeedPosts(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              postId
                ? {
                    ...item,
                    comment_count:
                      Math.max(
                        0,
                        (
                          item.comment_count ??
                          1
                        ) -
                          1
                      ),
                  }
                : item
          )
      );

      setCommentsPost(
        (
          current
        ) =>
          current?.id ===
          postId
            ? {
                ...current,
                comment_count:
                  Math.max(
                    0,
                    (
                      current.comment_count ??
                      1
                    ) -
                      1
                  ),
              }
            : current
      );

      setCommentBody(
        previousBody
      );

      setReplyTarget(
        previousReplyTarget
      );

      Alert.alert(
        'Could not comment',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setSubmittingComment(
        false
      );
    }
  }

  function confirmDeleteComment(
    comment:
      PostComment
  ) {
    Alert.alert(
      'Delete comment?',
      'This comment and any replies underneath it will be removed.',
      [
        {
          text:
            'Cancel',
          style:
            'cancel',
        },
        {
          text:
            'Delete',
          style:
            'destructive',
          onPress: () =>
            void removeSheetComment(
              comment.id
            ),
        },
      ]
    );
  }

  async function removeSheetComment(
    commentId: string
  ) {
    if (
      !commentsPost ||
      deletingCommentId
    ) {
      return;
    }

    try {
      setDeletingCommentId(
        commentId
      );

      await deletePostComment(
        commentId
      );

      if (
        replyTarget?.id ===
        commentId
      ) {
        setReplyTarget(
          null
        );
      }

      await loadCommentsSheet(
        commentsPost.id
      );
    } catch (
      error
    ) {
      console.error(
        'Could not delete comment:',
        error
      );

      Alert.alert(
        'Could not delete comment',
        'Please try again.'
      );
    } finally {
      setDeletingCommentId(
        null
      );
    }
  }

  function animateCommentActionsIn() {
    if (
      !commentActionTarget ||
      commentActionEntranceStarted.current ||
      commentActionClosing.current ||
      !commentActionSheetHeight.current
    ) {
      return;
    }

    commentActionEntranceStarted.current =
      true;

    commentActionTranslateY.stopAnimation();
    commentActionBackdropOpacity.stopAnimation();
    commentActionSheetOpacity.stopAnimation();
    commentSelectionAccentOpacity.stopAnimation();

    // The sheet is already mounted at its final bottom position.
    // Only a tiny 12px settle is animated so the user never sees
    // a full-height bottom-to-top travel.
    Animated.parallel([
      Animated.timing(
        commentActionTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentActionSheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentActionBackdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentSelectionAccentOpacity,
        {
          toValue:
            1,
          duration:
            70,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }

  function openCommentActions(
    comment:
      PostComment
  ) {
    if (
      commentActionTarget ||
      commentActionClosing.current
    ) {
      return;
    }

    Keyboard.dismiss();

    commentActionEntranceStarted.current =
      false;

    commentActionTranslateY.stopAnimation();
    commentActionBackdropOpacity.stopAnimation();
    commentActionSheetOpacity.stopAnimation();
    commentSelectionAccentOpacity.stopAnimation();

    // Mount invisibly at the final bottom position with only a
    // tiny downward offset. onLayout starts the short settle-in.
    commentActionTranslateY.setValue(
      12
    );
    commentActionBackdropOpacity.setValue(
      0
    );
    commentActionSheetOpacity.setValue(
      0
    );
    commentSelectionAccentOpacity.setValue(
      0
    );

    setHoldingCommentId(
      comment.id
    );

    setCommentActionTarget(
      comment
    );
  }

  function closeCommentActions(
    afterClose?: () => void,
    quickHandoff =
      false
  ) {
    if (
      !commentActionTarget ||
      commentActionClosing.current
    ) {
      return;
    }

    commentActionClosing.current =
      true;

    commentActionTranslateY.stopAnimation();
    commentActionBackdropOpacity.stopAnimation();
    commentActionSheetOpacity.stopAnimation();
    commentSelectionAccentOpacity.stopAnimation();

    Animated.timing(
      commentSelectionAccentOpacity,
      {
        toValue:
          0,
        duration:
          quickHandoff
            ? 55
            : 90,
        easing:
          Easing.inOut(
            Easing.cubic
          ),
        useNativeDriver:
          true,
      }
    ).start(({
      finished,
    }) => {
      if (
        finished
      ) {
        setHoldingCommentId(
          null
        );
      }
    });

    Animated.parallel([
      Animated.timing(
        commentActionTranslateY,
        {
          toValue:
            12,
          duration:
            quickHandoff
              ? 70
              : 115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentActionBackdropOpacity,
        {
          toValue:
            0,
          duration:
            quickHandoff
              ? 75
              : 120,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentActionSheetOpacity,
        {
          toValue:
            0,
          duration:
            quickHandoff
              ? 60
              : 100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      commentActionClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      commentActionEntranceStarted.current =
        false;

      commentActionTranslateY.setValue(
        12
      );

      commentActionSheetOpacity.setValue(
        0
      );

      setCommentActionTarget(
        null
      );

      afterClose?.();
    });
  }

  function beginCommentActionHandoff(
    action:
      () => void,
    delay =
      50
  ) {
    if (
      delay <=
      0
    ) {
      // Reply/Edit must never start the keyboard while the action
      // sheet is still mounted. Store the action, perform a very
      // fast close, then the effect above runs it only after React
      // has committed the sheet's removal.
      pendingCommentActionHandoff.current =
        action;

      closeCommentActions(
        undefined,
        true
      );
      return;
    }

    closeCommentActions();

    setTimeout(
      action,
      delay
    );
  }

  function replyToSelectedComment() {
    if (
      !commentActionTarget
    ) {
      return;
    }

    const target =
      commentActionTarget;

    beginCommentActionHandoff(
      () => {
        startReply(
          target
        );
      },
      0
    );
  }

  function startEditComment(
    comment:
      PostComment
  ) {
    startComposerWithKeyboard(
      () => {
        setReplyTarget(
          null
        );

        setEditingComment(
          comment
        );

        setCommentBody(
          comment.body
        );
      }
    );
  }

  function editSelectedComment() {
    if (
      !commentActionTarget ||
      !commentActionTarget.is_own
    ) {
      return;
    }

    const target =
      commentActionTarget;

    beginCommentActionHandoff(
      () => {
        startEditComment(
          target
        );
      },
      0
    );
  }

  function resetTemporaryCommentComposer() {
    if (
      !editingComment &&
      !replyTarget
    ) {
      return;
    }

    setComposerResetting(
      true
    );

    setReplyResetting(
      Boolean(
        replyTarget
      )
    );

    commentInputRef
      .current
      ?.clear();

    commentInputRef
      .current
      ?.blur();

    setCommentBody(
      ''
    );

    setEditingComment(
      null
    );

    setReplyTarget(
      null
    );

    Keyboard.dismiss();
  }

  function cancelCommentEdit() {
    resetTemporaryCommentComposer();
  }

  function handleCommentComposerOutsideTouch() {
    if (
      editingComment ||
      replyTarget
    ) {
      resetTemporaryCommentComposer();
      return;
    }

    if (
      commentsKeyboardVisible
    ) {
      Keyboard.dismiss();
    }
  }

  function reportSelectedComment() {
    if (
      !commentActionTarget ||
      commentActionTarget.is_own
    ) {
      return;
    }

    const target =
      commentActionTarget;

    beginCommentActionHandoff(
      () => {
        openCommentReport(
          target
        );
      },
      70
    );
  }

  function deleteSelectedComment() {
    if (
      !commentActionTarget ||
      !commentActionTarget.is_own
    ) {
      return;
    }

    const target =
      commentActionTarget;

    beginCommentActionHandoff(
      () => {
        confirmDeleteComment(
          target
        );
      },
      105
    );
  }

  function confirmBlockSelectedReader() {
    if (
      !commentActionTarget ||
      commentActionTarget.is_own
    ) {
      return;
    }

    const target =
      commentActionTarget;

    // Finish removing the comment menu before opening its confirmation.
    beginCommentActionHandoff(
      () => {
        setBlockConfirmTarget(target);
      },
      0
    );
  }

  async function blockSelectedReader(
    comment:
      PostComment
  ) {
    if (
      blockingReaderId
    ) {
      return;
    }

    try {
      setBlockingReaderId(
        comment.author_id
      );

      await blockReader(
        comment.author_id
      );

      // Keep the comments modal intact until the confirmation's native
      // dismissal completes, even when blocking the post's author.
      blockedReaderAfterDismiss.current = comment.author_id;

    } catch (
      error
    ) {
      console.error(
        'Could not block reader:',
        error
      );

      Alert.alert(
        'Could not block reader',
        'Please try again.'
      );

      throw error;
    } finally {
      setBlockingReaderId(
        null
      );
    }
  }

  async function finishBlockAfterDismiss() {
    const readerId =
      blockedReaderAfterDismiss.current;

    blockedReaderAfterDismiss.current =
      null;

    if (!readerId) {
      return;
    }

    const blockedPostAuthor =
      commentsPost?.author_id ===
      readerId;

    // A successful block can change the data backing the currently
    // open comments modal. Close that native modal first so a refresh
    // can never leave an invisible full-screen surface intercepting taps.
    if (blockedPostAuthor) {
      closeCommentsSheet(
        true
      );
    }

    try {
      if (
        !blockedPostAuthor &&
        commentsPost
      ) {
        await loadCommentsSheet(
          commentsPost.id
        );
      }

      await loadHomeData(
        false
      );
    } catch (
      error
    ) {
      console.error(
        'Could not refresh after blocking reader:',
        error
      );
    }
  }

  function sortSiblingComments(
    comments:
      PostComment[]
  ) {
    return [
      ...comments,
    ].sort(
      (
        first,
        second
      ) => {
        const firstOptimistic =
          first.id.startsWith(
            'optimistic-'
          );

        const secondOptimistic =
          second.id.startsWith(
            'optimistic-'
          );

        if (
          firstOptimistic !==
          secondOptimistic
        ) {
          return firstOptimistic
            ? -1
            : 1;
        }

        if (
          commentSort ===
          'newest'
        ) {
          return (
            new Date(
              second.created_at
            ).getTime() -
            new Date(
              first.created_at
            ).getTime()
          );
        }

        const scoreDifference =
          (
            second.vote_score ??
            0
          ) -
          (
            first.vote_score ??
            0
          );

        if (
          scoreDifference !==
          0
        ) {
          return scoreDifference;
        }

        return (
          new Date(
            second.created_at
          ).getTime() -
          new Date(
            first.created_at
          ).getTime()
        );
      }
    );
  }

  async function handleCommentVote(
    comment:
      PostComment,
    voteValue:
      CommentVoteValue
  ) {
    if (
      comment.id.startsWith(
        'optimistic-'
      ) ||
      votingCommentIds[
        comment.id
      ]
    ) {
      return;
    }

    const previous =
      comment;

    const previousVote =
      comment.viewer_vote ??
      0;

    const nextVote =
      previousVote ===
      voteValue
        ? 0
        : voteValue;

    const scoreDelta =
      nextVote -
      previousVote;

    const optimistic:
      PostComment = {
        ...comment,
        viewer_vote:
          nextVote,
        vote_score:
          (
            comment.vote_score ??
            0
          ) +
          scoreDelta,
        upvote_count:
          (
            comment.upvote_count ??
            0
          ) +
          (
            previousVote ===
              1
              ? -1
              : 0
          ) +
          (
            nextVote ===
              1
              ? 1
              : 0
          ),
        downvote_count:
          (
            comment.downvote_count ??
            0
          ) +
          (
            previousVote ===
              -1
              ? -1
              : 0
          ) +
          (
            nextVote ===
              -1
              ? 1
              : 0
          ),
      };

    setSheetComments(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            comment.id
              ? optimistic
              : item
        )
    );

    setVotingCommentIds(
      (
        current
      ) => ({
        ...current,
        [comment.id]:
          true,
      })
    );

    try {
      const result =
        await toggleCommentVote(
          comment.id,
          voteValue
        );

      setSheetComments(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              comment.id
                ? {
                    ...item,
                    ...result,
                  }
                : item
          )
      );
    } catch (
      error
    ) {
      console.error(
        'Could not update comment vote:',
        error
      );

      setSheetComments(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              comment.id
                ? previous
                : item
          )
      );
    } finally {
      setVotingCommentIds(
        (
          current
        ) => {
          const next = {
            ...current,
          };

          delete next[
            comment.id
          ];

          return next;
        }
      );
    }
  }

  function openCommentReport(
    comment: PostComment
  ) {
    if (
      comment.is_own ||
      commentReportSubmitting ||
      commentReportTarget ||
      commentReportSheetClosing.current
    ) {
      return;
    }

    Keyboard.dismiss();

    commentReportTranslateY.stopAnimation();
    commentReportBackdropOpacity.stopAnimation();
    commentReportSheetOpacity.stopAnimation();

    commentReportSheetHeight.current =
      0;
    commentReportEntranceStarted.current =
      false;
    commentReportSheetAnimating.current =
      false;
    commentReportSheetClosing.current =
      false;

    commentReportTranslateY.setValue(
      windowHeight + 80
    );
    commentReportBackdropOpacity.setValue(
      0
    );
    commentReportSheetOpacity.setValue(
      0
    );

    setCommentReportTarget(
      comment
    );
  }

  function animateCommentReportIn() {
    if (
      !commentReportTarget ||
      commentReportEntranceStarted.current ||
      !commentReportSheetHeight.current ||
      commentReportSheetAnimating.current ||
      commentReportSheetClosing.current
    ) {
      return;
    }

    commentReportTranslateY.stopAnimation();
    commentReportBackdropOpacity.stopAnimation();
    commentReportSheetOpacity.stopAnimation();

    commentReportSheetAnimating.current =
      true;
    commentReportEntranceStarted.current =
      true;

    commentReportTranslateY.setValue(
      commentReportSheetHeight.current +
        24
    );
    commentReportSheetOpacity.setValue(
      1
    );

    Animated.parallel([
      Animated.timing(
        commentReportTranslateY,
        {
          toValue:
            0,
          duration:
            320,
          easing:
            Easing.bezier(
              0.22,
              0.68,
              0.30,
              1
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentReportBackdropOpacity,
        {
          toValue:
            1,
          duration:
            320,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(() => {
      commentReportSheetAnimating.current =
        false;
    });
  }

  function closeCommentReport() {
    if (
      commentReportSubmitting ||
      commentReportSheetClosing.current
    ) {
      return;
    }

    dismissCommentReport();
  }

  function dismissCommentReport(
    afterClose?: () => void
  ) {
    if (
      commentReportSheetClosing.current
    ) {
      return;
    }

    commentReportSheetClosing.current =
      true;

    commentReportTranslateY.stopAnimation();
    commentReportBackdropOpacity.stopAnimation();

    commentReportSheetAnimating.current =
      true;

    Animated.parallel([
      Animated.timing(
        commentReportTranslateY,
        {
          toValue:
            commentReportSheetHeight.current +
            24,
          duration:
            245,
          easing:
            Easing.bezier(
              0.32,
              0,
              0.67,
              1
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        commentReportBackdropOpacity,
        {
          toValue:
            0,
          duration:
            245,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      commentReportSheetAnimating.current =
        false;

      if (
        !finished
      ) {
        commentReportSheetClosing.current =
          false;
        return;
      }

      setCommentReportTarget(
        null
      );

      commentReportSheetClosing.current =
        false;
      commentReportEntranceStarted.current =
        false;
      commentReportSheetHeight.current =
        0;

      afterClose?.();
    });
  }

  const commentReportPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) =>
            Boolean(
              commentReportTarget
            ) &&
            !commentReportSubmitting &&
            !commentReportSheetAnimating.current &&
            gesture.dy >
              6 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ) *
                1.05,

          onMoveShouldSetPanResponderCapture: (
            _event,
            gesture
          ) =>
            Boolean(
              commentReportTarget
            ) &&
            !commentReportSubmitting &&
            !commentReportSheetAnimating.current &&
            gesture.dy >
              9 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ) *
                1.12,

          onPanResponderMove: (
            _event,
            gesture
          ) => {
            commentReportTranslateY.setValue(
              Math.max(
                0,
                gesture.dy
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            const shouldDismiss =
              gesture.dy >
                92 ||
              gesture.vy >
                0.72;

            if (
              shouldDismiss
            ) {
              closeCommentReport();
              return;
            }

            commentReportSheetAnimating.current =
              true;

            Animated.spring(
              commentReportTranslateY,
              {
                toValue:
                  0,
                damping:
                  25,
                stiffness:
                  205,
                mass:
                  0.92,
                useNativeDriver:
                  true,
              }
            ).start(() => {
              commentReportSheetAnimating.current =
                false;
            });
          },

          onPanResponderTerminationRequest:
            () =>
              false,

          onPanResponderTerminate:
            () => {
              commentReportSheetAnimating.current =
                true;

              Animated.spring(
                commentReportTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    25,
                  stiffness:
                    205,
                  mass:
                    0.92,
                  useNativeDriver:
                    true,
                }
              ).start(() => {
                commentReportSheetAnimating.current =
                  false;
              });
            },
        }),
      [
        commentReportSubmitting,
        commentReportTarget,
        commentReportTranslateY,
      ]
    );

  async function handleCommentReport(
    reason: ReportReason
  ) {
    if (
      !commentReportTarget ||
      commentReportSubmitting
    ) {
      return;
    }

    try {
      setCommentReportSubmitting(
        true
      );

      await submitCommentReport(
        commentReportTarget.id,
        reason
      );

      dismissCommentReport(
        () => {
          Alert.alert(
            'Report submitted',
            'Thanks for letting us know. The comment has been added to the moderation queue.'
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        'Could not report comment:',
        error
      );

      Alert.alert(
        'Could not submit report',
        'Please try again.'
      );
    } finally {
      setCommentReportSubmitting(
        false
      );
    }
  }

  function renderSheetComment(
    comment:
      PostComment,
    depth = 0
  ) {
    const displayName =
      comment.author_display_name
        ?.trim() ||
      comment.author_username
        ?.trim() ||
      'Novori Reader';

    const username =
      comment.author_username
        ?.trim()
        ? `@${comment.author_username.trim()}`
        : '';

    const initial =
      displayName
        .charAt(0)
        .toUpperCase();

    const children =
      sortSiblingComments(
        sheetComments.filter(
          (
            item
          ) =>
            item.parent_comment_id ===
            comment.id
        )
      );

    const expanded =
      Boolean(
        expandedReplyThreads[
          comment.id
        ]
      );

    const visibleChildren =
      expanded
        ? children
        : children.slice(
            0,
            2
          );

    const hiddenCount =
      Math.max(
        0,
        children.length -
          visibleChildren.length
      );

    const visualDepth =
      Math.min(
        depth,
        3
      );

    if (
      comment.is_blocked_author
    ) {
      return (
        <View
          key={
            comment.id
          }
          style={[
            styles.sheetCommentThread,
            {
              marginLeft:
                visualDepth *
                14,
            },
          ]}
        >
          <View
            style={
              styles.blockedCommentCard
            }
          >
            <View
              style={
                styles.blockedCommentIcon
              }
            >
              <Ionicons
                name="ban-outline"
                size={
                  16
                }
                color={
                  COLORS.mutedText
                }
              />
            </View>

            <View
              style={
                styles.blockedCommentCopy
              }
            >
              <Text
                style={
                  styles.blockedCommentTitle
                }
              >
                Blocked reader
              </Text>

              <Text
                style={
                  styles.blockedCommentText
                }
              >
                This comment is hidden.
              </Text>
            </View>
          </View>

          {children.map(
            (
              child
            ) =>
              renderSheetComment(
                child,
                depth + 1
              )
          )}
        </View>
      );
    }

    return (
      <View
        key={
          comment.id
        }
        style={[
          styles.sheetCommentThread,
          {
            marginLeft:
              visualDepth *
              14,
          },
        ]}
      >
        <View
          style={[
            styles.sheetComment,
          ]}
        >
          {holdingCommentId ===
          comment.id ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sheetCommentActionAccent,
                {
                  opacity:
                    commentSelectionAccentOpacity,
                },
              ]}
            />
          ) : null}
          <Pressable
            onPress={() => {
              closeCommentsSheet();

              openReader(
                comment.author_id
              );
            }}
            style={({ pressed }) => [
              styles.sheetCommentAvatarButton,
              pressed &&
                styles.pressed,
            ]}
          >
            {comment.author_avatar_url ? (
              <Image
                source={{
                  uri:
                    comment.author_avatar_url,
                }}
                style={
                  styles.sheetCommentAvatar
                }
              />
            ) : (
              <View
                style={
                  styles.sheetCommentAvatarFallback
                }
              >
                <Text
                  style={
                    styles.sheetCommentAvatarText
                  }
                >
                  {initial}
                </Text>
              </View>
            )}
          </Pressable>

          <View
            style={
              styles.sheetCommentCopy
            }
          >
            <View
              style={
                styles.sheetCommentIdentity
              }
            >
              <Pressable
                onPress={() => {
                  closeCommentsSheet();

                  openReader(
                    comment.author_id
                  );
                }}
                hitSlop={
                  6
                }
                style={({ pressed }) => [
                  styles.sheetCommentNameButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.sheetCommentName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {displayName}
                </Text>
              </Pressable>

              {username ? (
                <Text
                  style={
                    styles.sheetCommentUsername
                  }
                  numberOfLines={
                    1
                  }
                >
                  {username}
                </Text>
              ) : null}

              <Text
                style={
                  styles.sheetCommentTime
                }
              >
                ·{' '}
                {formatFeedTime(
                  comment.created_at
                )}
              </Text>
            </View>

            <Pressable
              delayLongPress={
                220
              }
              onLongPress={() =>
                openCommentActions(
                  comment
                )
              }
              hitSlop={{
                top:
                  6,
                bottom:
                  8,
                left:
                  4,
                right:
                  4,
              }}
              style={
                styles.commentHoldTarget
              }
            >
              {renderExplicitContentWarning(
                comment.body,
                'comment',
                comment.id,
                styles.sheetCommentBody,
                comment.is_own
              )}
            </Pressable>

            <View
              style={
                styles.sheetCommentActions
              }
            >
              <View
                style={
                  styles.commentVoteControl
                }
              >
                <Pressable
                  disabled={
                    Boolean(
                      votingCommentIds[
                        comment.id
                      ]
                    )
                  }
                  onPress={() =>
                    void handleCommentVote(
                      comment,
                      1
                    )
                  }
                  hitSlop={
                    8
                  }
                  style={({ pressed }) => [
                    styles.commentVoteButton,
                    comment.viewer_vote ===
                      1 &&
                      styles.commentVoteButtonActive,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={
                      comment.viewer_vote ===
                      1
                        ? 'arrow-up-circle'
                        : 'arrow-up-circle-outline'
                    }
                    size={
                      21
                    }
                    color={
                      comment.viewer_vote ===
                      1
                        ? COLORS.gold
                        : COLORS.mutedText
                    }
                  />
                </Pressable>

                <Text
                  style={[
                    styles.commentVoteScore,
                    comment.viewer_vote !==
                      0 &&
                      styles.commentVoteScoreActive,
                  ]}
                >
                  {comment.vote_score ??
                    0}
                </Text>

                <Pressable
                  disabled={
                    Boolean(
                      votingCommentIds[
                        comment.id
                      ]
                    )
                  }
                  onPress={() =>
                    void handleCommentVote(
                      comment,
                      -1
                    )
                  }
                  hitSlop={
                    8
                  }
                  style={({ pressed }) => [
                    styles.commentVoteButton,
                    comment.viewer_vote ===
                      -1 &&
                      styles.commentVoteButtonActive,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={
                      comment.viewer_vote ===
                      -1
                        ? 'arrow-down-circle'
                        : 'arrow-down-circle-outline'
                    }
                    size={
                      21
                    }
                    color={
                      comment.viewer_vote ===
                      -1
                        ? COLORS.gold
                        : COLORS.mutedText
                    }
                  />
                </Pressable>
              </View>

            </View>
          </View>
        </View>

        {visibleChildren.length >
        0 ? (
          <View
            style={
              styles.sheetReplies
            }
          >
            {visibleChildren.map(
              (
                child
              ) =>
                renderSheetComment(
                  child,
                  depth + 1
                )
            )}
          </View>
        ) : null}

        {hiddenCount >
        0 ? (
          <Pressable
            onPress={() =>
              toggleReplies(
                comment.id
              )
            }
            style={({ pressed }) => [
              styles.viewMoreRepliesButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <View
              style={
                styles.replyGuide
              }
            />

            <Text
              style={
                styles.viewMoreRepliesText
              }
            >
              View {hiddenCount}{' '}
              more{' '}
              {hiddenCount ===
              1
                ? 'reply'
                : 'replies'}
            </Text>
          </Pressable>
        ) : expanded &&
          children.length >
            2 ? (
          <Pressable
            onPress={() =>
              toggleReplies(
                comment.id
              )
            }
            style={({ pressed }) => [
              styles.viewMoreRepliesButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <View
              style={
                styles.replyGuide
              }
            />

            <Text
              style={
                styles.viewMoreRepliesText
              }
            >
              Hide replies
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderClubCard(
    club:
      ClubWithMembership,
    compact = false
  ) {
    const initial =
      club.name
        .charAt(0)
        .toUpperCase();

    return (
      <Pressable
        key={club.id}
        onPress={() =>
          openClub(
            club.id
          )
        }
        style={({ pressed }) => [
          compact
            ? styles.compactClubCard
            : styles.clubCard,
          pressed &&
            styles.pressed,
        ]}
      >
        {club.cover_url ? (
          <Image
            source={{
              uri:
                club.cover_url,
            }}
            style={
              compact
                ? styles.compactClubImage
                : styles.clubImage
            }
          />
        ) : (
          <View
            style={
              compact
                ? styles.compactClubImageFallback
                : styles.clubImageFallback
            }
          >
            <Text
              style={
                compact
                  ? styles.compactClubInitial
                  : styles.clubInitial
              }
            >
              {initial}
            </Text>
          </View>
        )}

        <View
          style={
            styles.clubCardCopy
          }
        >
          <View
            style={
              styles.clubMetaRow
            }
          >
            <Ionicons
              name={
                club.privacy ===
                'public'
                  ? 'earth-outline'
                  : 'lock-closed-outline'
              }
              size={12}
              color={
                COLORS.softGold
              }
            />

            <Text
              style={
                styles.clubMetaText
              }
            >
              {club.privacy ===
              'public'
                ? 'Public'
                : 'Private'}
            </Text>

            <Text
              style={
                styles.clubMetaDot
              }
            >
              •
            </Text>

            <Text
              style={
                styles.clubMetaText
              }
            >
              {club.member_count}{' '}
              {club.member_count ===
              1
                ? 'member'
                : 'members'}
            </Text>
          </View>

          <Text
            style={
              styles.clubName
            }
            numberOfLines={
              1
            }
          >
            {club.name}
          </Text>

          {!compact &&
          club.description ? (
            <Text
              style={
                styles.clubDescription
              }
              numberOfLines={
                2
              }
            >
              {
                club.description
              }
            </Text>
          ) : null}

          {club.genres?.length ? (
            <View
              style={
                styles.clubGenreRow
              }
            >
              {club.genres
                .slice(
                  0,
                  compact
                    ? 1
                    : 2
                )
                .map(
                  (genre) => (
                    <View
                      key={
                        genre
                      }
                      style={
                        styles.clubGenreBadge
                      }
                    >
                      <Text
                        style={
                          styles.clubGenreBadgeText
                        }
                      >
                        {
                          getClubGenreLabel(
                            genre
                          )
                        }
                      </Text>
                    </View>
                  )
                )}

              {club.genres.length >
              (compact ? 1 : 2) ? (
                <Text
                  style={
                    styles.clubGenreMore
                  }
                >
                  +
                  {club.genres.length -
                    (compact
                      ? 1
                      : 2)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {club.membership_role ? (
            <View
              style={
                styles.membershipBadge
              }
            >
              <Text
                style={
                  styles.membershipBadgeText
                }
              >
                {club.membership_role ===
                'owner'
                  ? 'Owner'
                  : club.membership_role ===
                    'admin'
                  ? 'Admin'
                  : 'Member'}
              </Text>
            </View>
          ) : null}
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={
            COLORS.mutedText
          }
        />
      </Pressable>
    );
  }

  async function alwaysShowExplicitLanguage() {
    try {
      setAllowExplicitLanguage(
        true
      );

      await setExplicitLanguagePreference(
        true
      );
    } catch (
      error
    ) {
      console.error(
        'Could not save explicit-language preference:',
        error
      );

      setAllowExplicitLanguage(
        false
      );

      Alert.alert(
        'Could not save preference',
        'Please try again.'
      );
    }
  }

  function renderExplicitContentWarning(
    content:
      string,
    targetType:
      'post' | 'comment',
    targetId:
      string,
    textStyle:
      any,
    isOwnContent =
      false
  ) {
    const revealed =
      isExplicitContentRevealed(
        targetType,
        targetId
      ) ||
      (
        targetType ===
          'post'
          ? Boolean(
              revealedExplicitPosts[
                targetId
              ]
            )
          : Boolean(
              revealedExplicitComments[
                targetId
              ]
            )
      );

    const shouldHide =
      !isOwnContent &&
      !allowExplicitLanguage &&
      !revealed &&
      containsExplicitLanguage(
        content
      );

    if (
      !shouldHide
    ) {
      return (
        <Text
          style={
            textStyle
          }
        >
          {content}
        </Text>
      );
    }

    const revealOnce =
      () => {
        revealExplicitContentOnce(
          targetType,
          targetId
        );

        if (
          targetType ===
          'post'
        ) {
          setRevealedExplicitPosts(
            (
              current
            ) => ({
              ...current,
              [targetId]:
                true,
            })
          );
        } else {
          setRevealedExplicitComments(
            (
              current
            ) => ({
              ...current,
              [targetId]:
                true,
            })
          );
        }
      };

    return (
      <View
        style={
          styles.explicitContentWrap
        }
      >
        <Text
          style={[
            textStyle,
            styles.explicitContentSource,
          ]}
        >
          {content}
        </Text>

        <BlurView
          intensity={
            65
          }
          tint="dark"
          style={
            StyleSheet.absoluteFill
          }
        />

        <View
          style={
            styles.explicitWarningCard
          }
        >
          <View
            style={
              styles.explicitWarningHeading
            }
          >
            <Ionicons
              name="eye-off-outline"
              size={
                17
              }
              color={
                COLORS.gold
              }
            />

            <Text
              style={
                styles.explicitWarningTitle
              }
            >
              Explicit content warning
            </Text>
          </View>

          <Text
            style={
              styles.explicitWarningText
            }
          >
            This may contain explicit language.
          </Text>

          <View
            style={
              styles.explicitWarningActions
            }
          >
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                revealOnce();
              }}
              style={({ pressed }) => [
                styles.explicitWarningButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.explicitWarningButtonText
                }
              >
                Show once
              </Text>
            </Pressable>

            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                void alwaysShowExplicitLanguage();
              }}
              style={({ pressed }) => [
                styles.explicitWarningButton,
                styles.explicitWarningButtonPrimary,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.explicitWarningButtonText,
                  styles.explicitWarningButtonPrimaryText,
                ]}
              >
                Always show
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function formatFeedTime(
    createdAt: string
  ) {
    const created =
      new Date(
        createdAt
      );

    const diffMs =
      Date.now() -
      created.getTime();

    const minutes =
      Math.max(
        0,
        Math.floor(
          diffMs /
            60000
        )
      );

    if (
      minutes < 1
    ) {
      return 'now';
    }

    if (
      minutes < 60
    ) {
      return `${minutes}m`;
    }

    const hours =
      Math.floor(
        minutes /
          60
      );

    if (
      hours < 24
    ) {
      return `${hours}h`;
    }

    const days =
      Math.floor(
        hours /
          24
      );

    if (
      days < 7
    ) {
      return `${days}d`;
    }

    return created.toLocaleDateString(
      undefined,
      {
        month:
          'short',
        day:
          'numeric',
      }
    );
  }

  function formatCommentContextTime(
    createdAt: string
  ) {
    const value =
      formatFeedTime(
        createdAt
      );

    if (
      value === 'now'
    ) {
      return 'just now';
    }

    if (
      /^\d+[mhd]$/.test(
        value
      )
    ) {
      return `${value} ago`;
    }

    return value;
  }

  function openPostReport(
    post: FeedPost
  ) {
    if (
      !currentUserId ||
      post.author_id ===
        currentUserId
    ) {
      return;
    }

    if (reportTargetPost || reportSheetClosing.current) {
      return;
    }

    reportSubmitted.current = false;
    reportModalShown.current = false;
    reportEntranceStarted.current = false;
    reportSheetHeight.current = 0;
    reportSheetOpacity.setValue(0);
    reportTranslateY.stopAnimation();
    reportSheetOpacity.stopAnimation();
    reportBackdropOpacity.stopAnimation();

    reportTranslateY.setValue(
      12
    );
    reportBackdropOpacity.setValue(
      0
    );

    reportSheetAnimating.current =
      false;

    setReportTargetPost(
      post
    );
  }

  function animatePostReportIn() {
    // onShow and onLayout may arrive in either order. Wait for both.
    if (
      reportEntranceStarted.current ||
      !reportModalShown.current ||
      !reportSheetHeight.current ||
      reportSheetAnimating.current ||
      reportSheetClosing.current
    ) {
      return;
    }

    reportTranslateY.stopAnimation();
    reportSheetOpacity.stopAnimation();
    reportBackdropOpacity.stopAnimation();

    reportSheetAnimating.current =
      true;

    reportEntranceStarted.current =
      true;

    reportTranslateY.setValue(
      12
    );
    reportSheetOpacity.setValue(
      0
    );
    reportBackdropOpacity.setValue(
      0
    );

    Animated.parallel([
      Animated.timing(
        reportTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        reportSheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        reportBackdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(() => {
      reportSheetAnimating.current =
        false;
    });
  }

  function handleReportDismiss() {
    reportModalShown.current = false;
    reportSheetClosing.current = false;
    if (reportSubmitted.current) {
      reportSubmitted.current = false;
      Alert.alert(
        'Report submitted',
        'Thanks for letting us know. The report has been added to the moderation queue.'
      );
    }
  }

  function closePostReport() {
    if (reportSubmitting) {
      return;
    }
    dismissPostReport();
  }

  function dismissPostReport() {
    if (
      reportSheetClosing.current
    ) {
      return;
    }

    reportSheetClosing.current =
      true;

    reportTranslateY.stopAnimation();
    reportSheetOpacity.stopAnimation();
    reportBackdropOpacity.stopAnimation();

    reportSheetAnimating.current =
      true;

    Animated.parallel([
      Animated.timing(
        reportTranslateY,
        {
          toValue:
            12,
          duration:
            115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        reportSheetOpacity,
        {
          toValue:
            0,
          duration:
            100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        reportBackdropOpacity,
        {
          toValue:
            0,
          duration:
            120,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      reportSheetAnimating.current =
        false;

      if (
        finished
      ) {
        reportTranslateY.setValue(
          12
        );
        reportSheetOpacity.setValue(
          0
        );

        setReportTargetPost(
          null
        );

        if (
          Platform.OS !==
          'ios'
        ) {
          handleReportDismiss();
        }
      }
    });
  }

  const reportPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) =>
            !reportSubmitting &&
            !reportSheetAnimating.current &&
            gesture.dy >
              6 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ) *
                1.05,

          onMoveShouldSetPanResponderCapture: (
            _event,
            gesture
          ) =>
            !reportSubmitting &&
            !reportSheetAnimating.current &&
            gesture.dy >
              9 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ) *
                1.12,

          onPanResponderMove: (
            _event,
            gesture
          ) => {
            reportTranslateY.setValue(
              Math.max(
                0,
                gesture.dy
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            const shouldDismiss =
              gesture.dy >
                92 ||
              gesture.vy >
                0.72;

            if (
              shouldDismiss
            ) {
              closePostReport();
              return;
            }

            reportSheetAnimating.current =
              true;

            Animated.spring(
              reportTranslateY,
              {
                toValue: 0,
                damping: 25,
                stiffness: 205,
                mass: 0.92,
                useNativeDriver:
                  true,
              }
            ).start(() => {
              reportSheetAnimating.current =
                false;
            });
          },

          onPanResponderTerminationRequest:
            () =>
              false,

          onPanResponderTerminate:
            () => {
              reportSheetAnimating.current =
                true;

              Animated.spring(
                reportTranslateY,
                {
                  toValue: 0,
                  damping: 25,
                  stiffness: 205,
                  mass: 0.92,
                  useNativeDriver:
                    true,
                }
              ).start(() => {
                reportSheetAnimating.current =
                  false;
              });
            },
        }),
      [
        reportSubmitting,
        reportTranslateY,
        reportEntranceOffset,
        windowHeight,
      ]
    );

  async function handlePostReport(
    reason: ReportReason
  ) {
    if (
      !reportTargetPost ||
      reportSubmitting
    ) {
      return;
    }

    try {
      setReportSubmitting(
        true
      );

      await submitPostReport(
        reportTargetPost.id,
        reason
      );

      reportSubmitted.current = true;
      dismissPostReport();
    } catch (
      error
    ) {
      console.error(
        'Could not report post:',
        error
      );

      Alert.alert(
        'Could not submit report',
        'Please try again.'
      );
    } finally {
      setReportSubmitting(
        false
      );
    }
  }

  function editOwnPost(
    post: FeedPost
  ) {
    router.push({
      pathname:
        '/create-post',
      params: {
        editPostId:
          post.id,
      },
    });
  }

  function confirmDeleteOwnPost(
    post: FeedPost
  ) {
    Alert.alert(
      'Delete post?',
      'This post and its comments will be permanently deleted.',
      [
        {
          text:
            'Cancel',
          style:
            'cancel',
        },
        {
          text:
            'Delete',
          style:
            'destructive',
          onPress: () =>
            void removeOwnPost(
              post
            ),
        },
      ]
    );
  }

  async function removeOwnPost(
    post: FeedPost
  ) {
    if (
      deletingPostId
    ) {
      return;
    }

    try {
      setDeletingPostId(
        post.id
      );

      await deletePost(
        post.id
      );

      setFeedPosts(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.id !==
              post.id
          )
      );
    } catch (
      error
    ) {
      console.error(
        'Could not delete post:',
        error
      );

      Alert.alert(
        'Could not delete post',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setDeletingPostId(
        null
      );
    }
  }

  function openOwnPostOptions(
    post: FeedPost
  ) {
    if (
      deletingPostId ||
      ownPostOptionsTarget
    ) {
      return;
    }

    ownPostOptionsTranslateY.stopAnimation();
    ownPostOptionsSheetOpacity.stopAnimation();
    ownPostOptionsBackdropOpacity.stopAnimation();

    ownPostOptionsTranslateY.setValue(
      12
    );
    ownPostOptionsSheetOpacity.setValue(
      0
    );
    ownPostOptionsBackdropOpacity.setValue(
      0
    );

    setOwnPostOptionsTarget(
      post
    );
  }

  function animateOwnPostOptionsIn() {
    ownPostOptionsTranslateY.stopAnimation();
    ownPostOptionsSheetOpacity.stopAnimation();
    ownPostOptionsBackdropOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(
        ownPostOptionsTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        ownPostOptionsSheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        ownPostOptionsBackdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }

  function closeOwnPostOptions(
    afterClose?: () => void
  ) {
    ownPostOptionsTranslateY.stopAnimation();
    ownPostOptionsSheetOpacity.stopAnimation();
    ownPostOptionsBackdropOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(
        ownPostOptionsTranslateY,
        {
          toValue:
            12,
          duration:
            115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        ownPostOptionsSheetOpacity,
        {
          toValue:
            0,
          duration:
            100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        ownPostOptionsBackdropOpacity,
        {
          toValue:
            0,
          duration:
            120,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      if (
        !finished
      ) {
        return;
      }

      ownPostOptionsTranslateY.setValue(
        12
      );
      ownPostOptionsSheetOpacity.setValue(
        0
      );

      setOwnPostOptionsTarget(
        null
      );

      afterClose?.();
    });
  }

  function editSelectedOwnPost() {
    if (
      !ownPostOptionsTarget
    ) {
      return;
    }

    const post =
      ownPostOptionsTarget;

    closeOwnPostOptions(
      () =>
        editOwnPost(
          post
        )
    );
  }

  function deleteSelectedOwnPost() {
    if (
      !ownPostOptionsTarget
    ) {
      return;
    }

    const post =
      ownPostOptionsTarget;

    closeOwnPostOptions(
      () =>
        confirmDeleteOwnPost(
          post
        )
    );
  }

  async function handlePostVote(
    postId: string,
    voteValue:
      PostVoteValue
  ) {
    if (
      votingPostId ===
      postId
    ) {
      return;
    }

    try {
      setVotingPostId(
        postId
      );

      const nextVote =
        await togglePostVote(
          postId,
          voteValue
        );

      setFeedPosts(
        (
          current
        ) =>
          current.map(
            (
              post
            ) =>
              post.id ===
              postId
                ? {
                    ...post,
                    ...nextVote,
                  }
                : post
          )
      );
    } catch (
      error
    ) {
      console.error(
        'Could not update post vote:',
        error
      );
    } finally {
      setVotingPostId(
        null
      );
    }
  }

  function renderFeedPost(
    post:
      FeedPost
  ) {
    const displayName =
      post.author_display_name
        ?.trim() ||
      post.author_username
        ?.trim() ||
      'Novori Reader';

    const username =
      post.author_username
        ?.trim()
        ? `@${post.author_username.trim()}`
        : '';

    const initial =
      displayName
        .charAt(0)
        .toUpperCase();

    const clubInitial =
      post.club_name
        ?.charAt(0)
        .toUpperCase() ||
      'C';

    const isReadingUpdate =
      post.post_type ===
      'reading_update';

    const readingUpdate =
      isReadingUpdate
        ? parseReadingUpdateDisplay(
            post.body
          )
        : null;

    return (
      <Pressable
        key={
          post.id
        }
        onPress={() =>
          openCommentsSheet(
            post
          )
        }
        style={({ pressed }) => [
          styles.feedPostCard,
          pressed &&
            styles.feedPostCardPressed,
        ]}
      >
        <View
          style={
            styles.feedPostHeader
          }
        >
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              openReader(
                post.author_id
              );
            }}
            style={({ pressed }) => [
              pressed &&
                styles.pressed,
            ]}
          >
            {post.author_avatar_url ? (
              <Image
                source={{
                  uri:
                    post.author_avatar_url,
                }}
                style={
                  styles.feedAvatar
                }
              />
            ) : (
              <View
                style={
                  styles.feedAvatarFallback
                }
              >
                <Text
                  style={
                    styles.feedAvatarText
                  }
                >
                  {initial}
                </Text>
              </View>
            )}
          </Pressable>

          <View
            style={
              styles.feedAuthorCopy
            }
          >
            <View
              style={
                styles.feedAuthorLine
              }
            >
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  openReader(
                    post.author_id
                  );
                }}
                style={({ pressed }) => [
                  styles.feedIdentity,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.feedAuthorName
                  }
                  numberOfLines={
                    1
                  }
                  ellipsizeMode="tail"
                >
                  {displayName}
                </Text>

                {username ? (
                  <Text
                    style={
                      styles.feedUsername
                    }
                    numberOfLines={
                      1
                    }
                    ellipsizeMode="tail"
                  >
                    {username}
                  </Text>
                ) : null}
              </Pressable>

            </View>

            {post.club_id &&
            post.club_name ? (
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  openClub(
                    post.club_id!
                  );
                }}
                style={({
                  pressed,
                }) => [
                  styles.feedClubLine,
                  pressed &&
                    styles.pressed,
                ]}
              >
                {post.club_cover_url ? (
                  <Image
                    source={{
                      uri:
                        post.club_cover_url,
                    }}
                    style={
                      styles.feedClubIcon
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.feedClubIconFallback
                    }
                  >
                    <Text
                      style={
                        styles.feedClubIconText
                      }
                    >
                      {
                        clubInitial
                      }
                    </Text>
                  </View>
                )}

                <Text
                  style={
                    styles.feedClubText
                  }
                  numberOfLines={
                    1
                  }
                >
                  in{' '}
                  {
                    post.club_name
                  }{' '}
                  <Text
                    style={
                      styles.feedTime
                    }
                  >
                    ·{' '}
                    {formatFeedTime(
                      post.created_at
                    )}
                  </Text>
                </Text>
              </Pressable>
            ) : (
              <Text
                style={
                  styles.feedAudienceText
                }
              >
                posted to their profile{' '}
                <Text
                  style={
                    styles.feedTime
                  }
                >
                  ·{' '}
                  {formatFeedTime(
                    post.created_at
                  )}
                </Text>
              </Text>
            )}
          </View>

          {currentUserId ? (
            <Pressable
              disabled={
                deletingPostId ===
                post.id
              }
              onPress={(event) => {
                event.stopPropagation();

                if (
                  post.author_id ===
                  currentUserId
                ) {
                  openOwnPostOptions(
                    post
                  );
                } else {
                  openPostReport(
                    post
                  );
                }
              }}
              hitSlop={
                10
              }
              accessibilityRole="button"
              accessibilityLabel="More post options"
              style={({ pressed }) => [
                styles.feedMoreButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              {deletingPostId ===
              post.id ? (
                <ActivityIndicator
                  size="small"
                  color={
                    COLORS.mutedText
                  }
                />
              ) : (
                <Ionicons
                  name="ellipsis-horizontal"
                  size={
                    20
                  }
                  color={
                    COLORS.mutedText
                  }
                />
              )}
            </Pressable>
          ) : null}
        </View>

        <View
          style={
            styles.feedPostContent
          }
        >
          {isReadingUpdate ? (
            <>
              <View
                style={
                  styles.feedReadingUpdateLabel
                }
              >
                <Ionicons
                  name="book-outline"
                  size={
                    13
                  }
                  color={
                    COLORS.gold
                  }
                />

                <Text
                  style={
                    styles.feedReadingUpdateLabelText
                  }
                >
                  READING UPDATE
                </Text>
              </View>

              {post.book_title ? (
                <Pressable
                  disabled={
                    !post.google_book_id
                  }
                  onPress={(event) => {
                    event.stopPropagation();

                    if (
                      post.google_book_id
                    ) {
                      openBook(
                        post.google_book_id
                      );
                    }
                  }}
                  accessibilityRole={
                    post.google_book_id
                      ? 'button'
                      : undefined
                  }
                  accessibilityLabel={
                    post.google_book_id
                      ? `Open ${post.book_title}`
                      : undefined
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.feedReadingBookCard,
                    pressed &&
                      post.google_book_id &&
                      styles.feedReadingBookCardPressed,
                  ]}
                >
                  {post.book_cover_url ? (
                    <Image
                      source={{
                        uri:
                          post.book_cover_url,
                      }}
                      style={
                        styles.feedReadingBookCover
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.feedReadingBookCoverFallback
                      }
                    >
                      <Ionicons
                        name="book-outline"
                        size={
                          24
                        }
                        color={
                          COLORS.gold
                        }
                      />
                    </View>
                  )}

                  <View
                    style={
                      styles.feedReadingBookCopy
                    }
                  >
                    <Text
                      style={
                        styles.feedReadingBookTitle
                      }
                      numberOfLines={
                        2
                      }
                    >
                      {
                        post.book_title
                      }
                    </Text>

                    {readingUpdate &&
                    (
                      readingUpdate.pageLabel ||
                      readingUpdate.chapterLabel
                    ) ? (
                      <View
                        style={
                          styles.feedReadingProgressPills
                        }
                      >
                        {readingUpdate.pageLabel ? (
                          <View
                            style={
                              styles.feedReadingProgressPill
                            }
                          >
                            <Text
                              style={
                                styles.feedReadingProgressPillText
                              }
                            >
                              {
                                readingUpdate.pageLabel
                              }
                            </Text>
                          </View>
                        ) : null}

                        {readingUpdate.chapterLabel ? (
                          <View
                            style={
                              styles.feedReadingProgressPill
                            }
                          >
                            <Text
                              style={
                                styles.feedReadingProgressPillText
                              }
                            >
                              {
                                readingUpdate.chapterLabel
                              }
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {post.google_book_id ? (
                    <Ionicons
                      name="chevron-forward"
                      size={
                        18
                      }
                      color={
                        COLORS.mutedText
                      }
                    />
                  ) : null}
                </Pressable>
              ) : null}

              {readingUpdate
                ?.thought ? (
                <View
                  style={
                    styles.feedReadingThoughtWrap
                  }
                >
                  {renderExplicitContentWarning(
                    readingUpdate.thought,
                    'post',
                    post.id,
                    styles.feedReadingThought,
                    Boolean(
                      currentUserId &&
                      post.author_id ===
                        currentUserId
                    )
                  )}
                </View>
              ) : (
                <Text
                  style={
                    styles.feedReadingMuted
                  }
                >
                  Progress update
                </Text>
              )}
            </>
          ) : (
            <>
              {renderExplicitContentWarning(
                post.body,
                'post',
                post.id,
                styles.feedBody,
                Boolean(
                  currentUserId &&
                  post.author_id ===
                    currentUserId
                )
              )}

              {post.book_title ? (
                <Pressable
                  disabled={
                    !post.google_book_id
                  }
                  onPress={(event) => {
                    event.stopPropagation();

                    if (
                      post.google_book_id
                    ) {
                      openBook(
                        post.google_book_id
                      );
                    }
                  }}
                  style={({
                    pressed,
                  }) => [
                    styles.feedBookCard,
                    pressed &&
                      post.google_book_id &&
                      styles.pressed,
                  ]}
                >
                  {post.book_cover_url ? (
                    <Image
                      source={{
                        uri:
                          post.book_cover_url,
                      }}
                      style={
                        styles.feedBookCover
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.feedBookCoverFallback
                      }
                    >
                      <Ionicons
                        name="book-outline"
                        size={
                          22
                        }
                        color={
                          COLORS.gold
                        }
                      />
                    </View>
                  )}

                  <View
                    style={
                      styles.feedBookCopy
                    }
                  >
                    <View
                      style={
                        styles.feedBookEyebrow
                      }
                    >
                      <Ionicons
                        name="book-outline"
                        size={
                          12
                        }
                        color={
                          COLORS.gold
                        }
                      />

                      <Text
                        style={
                          styles.feedBookEyebrowText
                        }
                      >
                        Book
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.feedBookTitle
                      }
                      numberOfLines={
                        2
                      }
                    >
                      {
                        post.book_title
                      }
                    </Text>

                    {post.rating ? (
                      <View
                        style={
                          styles.feedBookRatingRow
                        }
                      >
                        <Ionicons
                          name="star"
                          size={
                            13
                          }
                          color={
                            COLORS.gold
                          }
                        />

                        <Text
                          style={
                            styles.feedBookRating
                          }
                        >
                          {
                            post.rating
                          }
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {post.google_book_id ? (
                    <Ionicons
                      name="chevron-forward"
                      size={
                        17
                      }
                      color={
                        COLORS.mutedText
                      }
                    />
                  ) : null}
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        <View
          style={
            styles.feedPostFooter
          }
        >
          <View
            style={
              styles.voteControl
            }
          >
            <Pressable
              disabled={
                votingPostId ===
                post.id
              }
              onPress={(event) => {
                event.stopPropagation();
                handlePostVote(
                  post.id,
                  1
                );
              }}
              hitSlop={
                8
              }
              style={({ pressed }) => [
                styles.voteButton,
                post.viewer_vote ===
                  1 &&
                  styles.voteButtonActive,
                pressed &&
                  styles.pressed,
                votingPostId ===
                  post.id &&
                  styles.voteButtonDisabled,
              ]}
            >
              <Ionicons
                name={
                  post.viewer_vote ===
                  1
                    ? 'arrow-up-circle'
                    : 'arrow-up-circle-outline'
                }
                size={
                  20
                }
                color={
                  post.viewer_vote ===
                  1
                    ? COLORS.gold
                    : COLORS.mutedText
                }
              />
            </Pressable>

            <Text
              style={[
                styles.voteScore,
                post.viewer_vote !==
                  0 &&
                  styles.voteScoreActive,
              ]}
            >
              {post.vote_score ??
                0}
            </Text>

            <Pressable
              disabled={
                votingPostId ===
                post.id
              }
              onPress={(event) => {
                event.stopPropagation();
                handlePostVote(
                  post.id,
                  -1
                );
              }}
              hitSlop={
                8
              }
              style={({ pressed }) => [
                styles.voteButton,
                post.viewer_vote ===
                  -1 &&
                  styles.voteButtonActive,
                pressed &&
                  styles.pressed,
                votingPostId ===
                  post.id &&
                  styles.voteButtonDisabled,
              ]}
            >
              <Ionicons
                name={
                  post.viewer_vote ===
                  -1
                    ? 'arrow-down-circle'
                    : 'arrow-down-circle-outline'
                }
                size={
                  20
                }
                color={
                  post.viewer_vote ===
                  -1
                    ? COLORS.gold
                    : COLORS.mutedText
                }
              />
            </Pressable>
          </View>

          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              openCommentsSheet(
                post
              );
            }}
            hitSlop={
              8
            }
            style={({ pressed }) => [
              styles.commentAction,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="chatbubble-outline"
              size={
                16
              }
              color={
                COLORS.mutedText
              }
            />

            <Text
              style={
                styles.commentActionText
              }
            >
              {post.comment_count ??
                0}{' '}
              {(post.comment_count ??
                0) ===
              1
                ? 'comment'
                : 'comments'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function renderFeed() {
    if (
      feedLoading
    ) {
      return (
        <View
          style={
            styles.feedLoading
          }
        >
          <ActivityIndicator
            size="small"
            color={
              COLORS.gold
            }
          />
        </View>
      );
    }

    if (
      feedError
    ) {
      return (
        <View
          style={
            styles.feedEmptyCard
          }
        >
          <Ionicons
            name="cloud-offline-outline"
            size={
              27
            }
            color={
              COLORS.mutedText
            }
          />

          <Text
            style={
              styles.feedEmptyTitle
            }
          >
            Feed unavailable
          </Text>

          <Text
            style={
              styles.feedEmptyText
            }
          >
            {feedError}
          </Text>

          <Pressable
            onPress={() =>
              loadHomeData(
                true
              )
            }
            style={({ pressed }) => [
              styles.feedActionButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.feedActionButtonText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    if (
      feedPosts.length ===
      0
    ) {
      return (
        <View
          style={
            styles.feedEmptyCard
          }
        >
          <View
            style={
              styles.feedEmptyIcon
            }
          >
            <Ionicons
              name="newspaper-outline"
              size={
                27
              }
              color={
                COLORS.gold
              }
            />
          </View>

          <Text
            style={
              styles.feedEmptyTitle
            }
          >
            Your feed is ready.
          </Text>

          <Text
            style={
              styles.feedEmptyText
            }
          >
            Posts from readers you follow and clubs you’ve joined will appear here. You can also make the first post yourself.
          </Text>

          <Pressable
            onPress={() =>
              router.push(
                '/create-post'
              )
            }
            style={({ pressed }) => [
              styles.feedActionButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={
                17
              }
              color={
                COLORS.background
              }
            />

            <Text
              style={
                styles.feedActionButtonText
              }
            >
              Create Post
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View
        style={
          styles.feedList
        }
      >
        <View
          style={
            styles.feedHeadingRow
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Your Feed
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Readers you follow and clubs you belong to.
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/create-post'
              )
            }
            style={({ pressed }) => [
              styles.feedComposeButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={
                17
              }
              color={
                COLORS.background
              }
            />

            <Text
              style={
                styles.feedComposeButtonText
              }
            >
              Post
            </Text>
          </Pressable>
        </View>

        {feedPosts.map(
          renderFeedPost
        )}
      </View>
    );
  }

  function renderClubs() {
    if (
      clubsLoading
    ) {
      return (
        <View
          style={
            styles.clubsLoading
          }
        >
          <ActivityIndicator
            size="small"
            color={
              COLORS.gold
            }
          />
        </View>
      );
    }

    const isSearching =
      Boolean(
        clubSearch.trim()
      );

    const filteredDiscoverClubs =
      activeClubGenre ===
      'all'
        ? discoverClubs
        : discoverClubs.filter(
            (club) =>
              club.genres?.includes(
                activeClubGenre
              )
          );

    return (
      <View>
        <View
          style={
            styles.clubSearchWrap
          }
        >
          <Ionicons
            name="search-outline"
            size={19}
            color={
              COLORS.mutedText
            }
          />

          <TextInput
            value={
              clubSearch
            }
            onChangeText={
              setClubSearch
            }
            placeholder="Search clubs by name or ID"
            placeholderTextColor={
              COLORS.mutedText
            }
            autoCapitalize="none"
            autoCorrect={
              false
            }
            returnKeyType="search"
            style={
              styles.clubSearchInput
            }
          />

          {clubSearchLoading ? (
            <ActivityIndicator
              size="small"
              color={
                COLORS.gold
              }
            />
          ) : clubSearch ? (
            <Pressable
              onPress={() =>
                setClubSearch(
                  ''
                )
              }
              hitSlop={
                8
              }
              style={({
                pressed,
              }) => [
                styles.clubSearchClear,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="close-circle"
                size={
                  19
                }
                color={
                  COLORS.mutedText
                }
              />
            </Pressable>
          ) : null}
        </View>

        <Text
          style={
            styles.clubSearchHint
          }
        >
          Search public clubs by name. Exact club IDs also work.
        </Text>

        {isSearching ? (
          <View>
            <View
              style={
                styles.searchResultsHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Search Results
              </Text>

              {!clubSearchLoading &&
              !clubSearchError ? (
                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  {clubSearchResults.length}{' '}
                  {clubSearchResults.length ===
                  1
                    ? 'club'
                    : 'clubs'}
                </Text>
              ) : null}
            </View>

            {clubSearchError ? (
              <View
                style={
                  styles.searchEmpty
                }
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={
                    25
                  }
                  color={
                    COLORS.mutedText
                  }
                />

                <Text
                  style={
                    styles.searchEmptyTitle
                  }
                >
                  Search unavailable
                </Text>

                <Text
                  style={
                    styles.searchEmptyText
                  }
                >
                  {clubSearchError}
                </Text>
              </View>
            ) : clubSearchLoading ? (
              <View
                style={
                  styles.searchLoading
                }
              >
                <ActivityIndicator
                  size="small"
                  color={
                    COLORS.gold
                  }
                />
              </View>
            ) : clubSearchResults.length >
              0 ? (
              <View
                style={
                  styles.clubList
                }
              >
                {clubSearchResults.map(
                  (club) =>
                    renderClubCard(
                      club
                    )
                )}
              </View>
            ) : (
              <View
                style={
                  styles.searchEmpty
                }
              >
                <Ionicons
                  name="search-outline"
                  size={
                    25
                  }
                  color={
                    COLORS.mutedText
                  }
                />

                <Text
                  style={
                    styles.searchEmptyTitle
                  }
                >
                  No clubs found
                </Text>

                <Text
                  style={
                    styles.searchEmptyText
                  }
                >
                  Try a different club name or paste an exact club ID.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
        <View
          style={
            styles.sectionHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Your Clubs
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Communities you’ve joined or created.
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/create-club'
              )
            }
            style={({ pressed }) => [
              styles.createClubButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={17}
              color={
                COLORS.background
              }
            />

            <Text
              style={
                styles.createClubButtonText
              }
            >
              Create
            </Text>
          </Pressable>
        </View>

        {myClubs.length >
        0 ? (
          <View
            style={
              styles.clubList
            }
          >
            {myClubs.map(
              (club) =>
                renderClubCard(
                  club,
                  true
                )
            )}
          </View>
        ) : (
          <Pressable
            onPress={() =>
              router.push(
                '/create-club'
              )
            }
            style={({ pressed }) => [
              styles.emptyClubsCard,
              pressed &&
                styles.pressed,
            ]}
          >
            <View
              style={
                styles.emptyClubsIcon
              }
            >
              <Ionicons
                name="people-outline"
                size={24}
                color={
                  COLORS.gold
                }
              />
            </View>

            <View
              style={
                styles.emptyClubsCopy
              }
            >
              <Text
                style={
                  styles.emptyClubsTitle
                }
              >
                Start your first club
              </Text>

              <Text
                style={
                  styles.emptyClubsText
                }
              >
                Build a reading community around a genre, author, series, or shared interest.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                COLORS.mutedText
              }
            />
          </Pressable>
        )}

        <View
          style={
            styles.discoverHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Discover Clubs
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            Public communities open to new readers.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.clubGenreFilterRow
          }
          style={
            styles.clubGenreFilterScroll
          }
        >
          <Pressable
            onPress={() =>
              setActiveClubGenre(
                'all'
              )
            }
            style={[
              styles.clubGenreFilterChip,
              activeClubGenre ===
                'all' &&
                styles.clubGenreFilterChipActive,
            ]}
          >
            <Text
              style={[
                styles.clubGenreFilterText,
                activeClubGenre ===
                  'all' &&
                  styles.clubGenreFilterTextActive,
              ]}
            >
              All Genres
            </Text>
          </Pressable>

          {CLUB_GENRES.map(
            (genre) => {
              const active =
                activeClubGenre ===
                genre.key;

              return (
                <Pressable
                  key={
                    genre.key
                  }
                  onPress={() =>
                    setActiveClubGenre(
                      genre.key
                    )
                  }
                  style={[
                    styles.clubGenreFilterChip,
                    active &&
                      styles.clubGenreFilterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.clubGenreFilterText,
                      active &&
                        styles.clubGenreFilterTextActive,
                    ]}
                  >
                    {genre.label}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {filteredDiscoverClubs.length >
        0 ? (
          <View
            style={
              styles.clubList
            }
          >
            {filteredDiscoverClubs.map(
              (club) =>
                renderClubCard(
                  club
                )
            )}
          </View>
        ) : (
          <View
            style={
              styles.discoverEmpty
            }
          >
            <Ionicons
              name="compass-outline"
              size={26}
              color={
                COLORS.mutedText
              }
            />

            <Text
              style={
                styles.discoverEmptyTitle
              }
            >
              {activeClubGenre ===
              'all'
                ? 'No public clubs yet.'
                : `No ${getClubGenreLabel(
                    activeClubGenre
                  )} clubs yet.`}
            </Text>

            <Text
              style={
                styles.discoverEmptyText
              }
            >
              {activeClubGenre ===
              'all'
                ? 'When readers create public clubs, they’ll appear here.'
                : 'Try another genre or switch back to All Genres.'}
            </Text>
          </View>
        )}
          </>
        )}
      </View>
    );
  }

  const rootComments =
    sortSiblingComments(
      sheetComments.filter(
        (
          comment
        ) =>
          !comment.parent_comment_id
      )
    );

  const canSubmitComment =
    Boolean(
      commentBody.trim()
    ) &&
    !submittingComment;

  const composerDisplayName =
    composerProfile
      ?.display_name
      ?.trim() ||
    composerProfile
      ?.username
      ?.trim() ||
    'You';

  const composerAvatarInitial =
    composerDisplayName
      .charAt(0)
      .toUpperCase() ||
    'Y';

  return (
    <>
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
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              handleRefresh
            }
            tintColor={
              COLORS.gold
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.content
          }
        >
          <View
            style={
              styles.topRow
            }
          >
            <View
              style={
                styles.brandBlock
              }
            >
              <Text
                style={
                  styles.logo
                }
              >
                Novori
              </Text>

              <Text
                style={
                  styles.slogan
                }
              >
                Read. Discuss. Belong.
              </Text>
            </View>

            <Pressable
              onPress={() =>
                router.push(
                  '/(tabs)/notifications'
                )
              }
              hitSlop={10}
              style={({
                pressed,
              }) => [
                styles.notificationButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name={
                  attentionCount >
                  0
                    ? 'notifications'
                    : 'notifications-outline'
                }
                size={24}
                color={
                  attentionCount >
                  0
                    ? COLORS.gold
                    : COLORS.text
                }
              />

              {attentionCount >
              0 ? (
                <View
                  style={
                    styles.notificationBadge
                  }
                >
                  <Text
                    style={
                      styles.notificationBadgeText
                    }
                  >
                    {attentionCount >
                    99
                      ? '99+'
                      : attentionCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View
            style={
              styles.sectionSwitch
            }
          >
            <Pressable
              onPress={() =>
                setActiveSection(
                  'feed'
                )
              }
              style={[
                styles.sectionSwitchButton,
                activeSection ===
                  'feed' &&
                  styles.sectionSwitchButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.sectionSwitchText,
                  activeSection ===
                    'feed' &&
                    styles.sectionSwitchTextActive,
                ]}
              >
                Feed
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setActiveSection(
                  'clubs'
                )
              }
              style={[
                styles.sectionSwitchButton,
                activeSection ===
                  'clubs' &&
                  styles.sectionSwitchButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.sectionSwitchText,
                  activeSection ===
                    'clubs' &&
                    styles.sectionSwitchTextActive,
                ]}
              >
                Clubs
              </Text>
            </Pressable>
          </View>

          {activeSection ===
          'feed'
            ? renderFeed()
            : renderClubs()}
        </View>
      </ScrollView>


    </SafeAreaView>

      <Modal
        visible={
          Boolean(
            ownPostOptionsTarget
          )
        }
        transparent
        animationType="none"
        onShow={
          animateOwnPostOptionsIn
        }
        onRequestClose={() =>
          closeOwnPostOptions()
        }
      >
        <Pressable
          style={
            styles.ownPostOptionsBackdrop
          }
          onPress={() =>
            closeOwnPostOptions()
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ownPostOptionsBackdropVisual,
              {
                opacity:
                  ownPostOptionsBackdropOpacity,
              },
            ]}
          />

          <Animated.View
            style={[
              styles.ownPostOptionsSheet,
              {
                paddingBottom:
                  Math.max(
                    18,
                    insets.bottom +
                      12
                  ),
                opacity:
                  ownPostOptionsSheetOpacity,
                transform: [
                  {
                    translateY:
                      ownPostOptionsTranslateY,
                  },
                ],
              },
            ]}
          >
            <Pressable
              onPress={(event) =>
                event.stopPropagation()
              }
            >
              <View
                style={
                  styles.ownPostOptionsHandle
                }
              />

              <View
                style={
                  styles.ownPostOptionsHeader
                }
              >
                <View
                  style={
                    styles.ownPostOptionsHeaderIcon
                  }
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={
                      19
                    }
                    color={
                      COLORS.gold
                    }
                  />
                </View>

                <View
                  style={
                    styles.ownPostOptionsHeaderCopy
                  }
                >
                  <Text
                    style={
                      styles.ownPostOptionsTitle
                    }
                  >
                    Post options
                  </Text>

                  <Text
                    style={
                      styles.ownPostOptionsSubtitle
                    }
                  >
                    Manage your post.
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.ownPostOptionsList
                }
              >
                <Pressable
                  onPress={
                    editSelectedOwnPost
                  }
                  style={({ pressed }) => [
                    styles.ownPostOptionsRow,
                    pressed &&
                      styles.ownPostOptionsRowPressed,
                  ]}
                >
                  <View
                    style={
                      styles.ownPostOptionsRowIcon
                    }
                  >
                    <Ionicons
                      name="create-outline"
                      size={
                        20
                      }
                      color={
                        COLORS.gold
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.ownPostOptionsRowCopy
                    }
                  >
                    <Text
                      style={
                        styles.ownPostOptionsRowTitle
                      }
                    >
                      Edit Post
                    </Text>

                    <Text
                      style={
                        styles.ownPostOptionsRowSubtitle
                      }
                    >
                      Update what you shared.
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={
                      18
                    }
                    color={
                      COLORS.mutedText
                    }
                  />
                </Pressable>

                <View
                  style={
                    styles.ownPostOptionsDivider
                  }
                />

                <Pressable
                  onPress={
                    deleteSelectedOwnPost
                  }
                  style={({ pressed }) => [
                    styles.ownPostOptionsRow,
                    pressed &&
                      styles.ownPostOptionsRowPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.ownPostOptionsRowIcon,
                      styles.ownPostOptionsDangerIcon,
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={
                        20
                      }
                      color={
                        COLORS.danger
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.ownPostOptionsRowCopy
                    }
                  >
                    <Text
                      style={
                        styles.ownPostOptionsDangerTitle
                      }
                    >
                      Delete Post
                    </Text>

                    <Text
                      style={
                        styles.ownPostOptionsRowSubtitle
                      }
                    >
                      Permanently remove this post.
                    </Text>
                  </View>
                </Pressable>
              </View>

              <Text
                style={
                  styles.ownPostOptionsHint
                }
              >
                Tap outside to cancel
              </Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        visible={
          Boolean(
            reportTargetPost
          )
        }
        transparent
        animationType="none"
        onShow={() => {
          reportModalShown.current = true;
          animatePostReportIn();
        }}
        onDismiss={handleReportDismiss}
        onRequestClose={
          closePostReport
        }
      >
        <Pressable
          style={
            styles.reportBackdrop
          }
          onPress={
            closePostReport
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.reportBackdropVisual,
              {
                opacity:
                  reportBackdropOpacity,
              },
            ]}
          />

          <Animated.View
            {...reportPanResponder.panHandlers}
            onLayout={(event) => {
              reportSheetHeight.current = event.nativeEvent.layout.height;
              if (!reportSheetAnimating.current && !reportSheetClosing.current) {
                animatePostReportIn();
              }
            }}
            style={[
              styles.reportSheet,
              {
                paddingBottom: Math.max(18, insets.bottom + 12),
                opacity: reportSheetOpacity,
                transform: [
                  {
                    translateY:
                      reportTranslateY,
                  },
                ],
              },
            ]}
          >
            <Pressable
              onPress={(event) =>
                event.stopPropagation()
              }
            >
            <View
              style={
                styles.reportHandle
              }
            />

            <View
              style={
                styles.reportHeadingRow
              }
            >
              <View
                style={
                  styles.reportHeadingCopy
                }
              >
                <Text
                  style={
                    styles.reportTitle
                  }
                >
                  Report post
                </Text>

                <Text
                  style={
                    styles.reportSubtitle
                  }
                >
                  Why are you reporting this post?
                </Text>
              </View>

              <Pressable
                onPress={
                  closePostReport
                }
                hitSlop={
                  10
                }
                style={({ pressed }) => [
                  styles.reportCloseButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="close"
                  size={
                    21
                  }
                  color={
                    COLORS.text
                  }
                />
              </Pressable>
            </View>

            <View
              style={
                styles.reportReasonList
              }
            >
              {POST_REPORT_REASONS.map(
                (
                  reason
                ) => (
                  <Pressable
                    key={
                      reason.value
                    }
                    disabled={
                      reportSubmitting
                    }
                    onPress={() =>
                      handlePostReport(
                        reason.value
                      )
                    }
                    style={({ pressed }) => [
                      styles.reportReasonButton,
                      pressed &&
                        styles.reportReasonButtonPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.reportReasonIcon
                      }
                    >
                      <Ionicons
                        name={
                          reason.icon
                        }
                        size={
                          18
                        }
                        color={
                          COLORS.gold
                        }
                      />
                    </View>

                    <Text
                      style={
                        styles.reportReasonText
                      }
                    >
                      {
                        reason.label
                      }
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={
                        17
                      }
                      color={
                        COLORS.mutedText
                      }
                    />
                  </Pressable>
                )
              )}
            </View>

            <Text
              style={
                styles.reportPrivacyText
              }
            >
              Reports are private. The post author won’t be told who reported them.
            </Text>

            {reportSubmitting ? (
              <View
                style={
                  styles.reportSubmitting
                }
              >
                <ActivityIndicator
                  size="small"
                  color={
                    COLORS.gold
                  }
                />
              </View>
            ) : null}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        visible={
          commentsModalVisible
        }
        transparent
        animationType="none"
        onShow={
          animateCommentsSheetIn
        }
        onDismiss={
          handleCommentsModalDismiss
        }
        onRequestClose={() => closeCommentsSheet()}
      >
        <View
          style={
            styles.commentsModalRoot
          }
        >
          <View
            style={
              styles.commentsBackdrop
            }
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.commentsBackdropVisual,
                {
                  opacity:
                    commentsBackdropOpacity,
                },
              ]}
            >
              <BlurView
                intensity={
                  24
                }
                tint="dark"
                style={
                  StyleSheet.absoluteFill
                }
              />

              <View
                style={
                  styles.commentsBackdropDim
                }
              />
            </Animated.View>

            <Pressable
              style={
                styles.commentsBackdropTap
              }
              onPress={
                handleCommentsBackdropPress
              }
            />

            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.commentsEntranceLayer,
                {
                  transform: [
                    {
                      translateY:
                        commentsEntranceTranslateY,
                    },
                  ],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.commentsSheet,
                  {
                    height:
                      commentsSheetHeight,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.commentsKeyboardLayer,
                    {
                      opacity:
                        commentsContentOpacity,
                    },
                  ]}
                >
              <View
                {...commentsSheetPanResponder.panHandlers}
                onTouchStart={
                  handleCommentComposerOutsideTouch
                }
                style={
                  styles.commentsDragRegion
                }
              >
                <View
                  style={
                    styles.commentsSheetHandle
                  }
                />

                <View
                  style={
                    styles.commentsSheetHeader
                  }
                >
                  <Text
                    style={
                      styles.commentsSheetTitle
                    }
                  >
                    Comments
                  </Text>
                </View>
              </View>

              <View
                onTouchStart={
                  handleCommentComposerOutsideTouch
                }
                style={
                  styles.commentsMetaRow
                }
              >
                  <Text
                    style={
                      styles.commentsIdentityText
                    }
                    numberOfLines={
                      1
                    }
                  >
                    On{' '}
                    <Text
                      style={
                        styles.commentsIdentityName
                      }
                    >
                      {commentsPost
                        ?.author_username
                        ?.trim()
                        ? `@${commentsPost.author_username.trim()}`
                        : commentsPost
                            ?.author_display_name
                            ?.trim() ||
                          'Novori Reader'}
                    </Text>
                    {'’s post · '}
                    {commentsPost
                      ? formatCommentContextTime(
                          commentsPost.created_at
                        )
                      : ''}
                  </Text>

                  <View
                    style={
                      styles.commentsSortWrap
                    }
                  >
                    <Pressable
                      onPress={() =>
                        setCommentSort(
                          (current) =>
                            current ===
                            'top'
                              ? 'newest'
                              : 'top'
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        commentSort ===
                        'top'
                          ? 'Sort comments by newest'
                          : 'Sort comments by top'
                      }
                      hitSlop={
                        8
                      }
                      style={({ pressed }) => [
                        styles.commentsSortTrigger,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="swap-vertical-outline"
                        size={
                          15
                        }
                        color={
                          COLORS.mutedText
                        }
                      />

                      <Text
                        style={
                          styles.commentsSortTriggerText
                        }
                      >
                        {commentSort ===
                        'top'
                          ? 'Top'
                          : 'Newest'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

              <View
                {...commentsSheetPanResponder.panHandlers}
                onTouchStart={
                  handleCommentComposerOutsideTouch
                }
                style={[
                  styles.commentsSideRail,
                  styles.commentsSideRailLeft,
                ]}
              />

              <View
                {...commentsSheetPanResponder.panHandlers}
                onTouchStart={
                  handleCommentComposerOutsideTouch
                }
                style={[
                  styles.commentsSideRail,
                  styles.commentsSideRailRight,
                ]}
              />

              <View
                onTouchStart={
                  handleCommentComposerOutsideTouch
                }
                style={
                  styles.commentsListWrap
                }
              >
                {!commentsInitialLoadReady ? (
                  <View
                    style={
                      styles.commentsLoading
                    }
                  />
                ) : (
                  <Animated.View
                    style={[
                      styles.commentsResultLayer,
                      {
                        opacity:
                          commentsResultOpacity,
                      },
                    ]}
                  >
                    {rootComments.length >
                    0 ? (
                      <ScrollView
                        onTouchStart={
                          handleCommentComposerOutsideTouch
                        }
                        style={
                          styles.commentsList
                        }
                        contentContainerStyle={
                          styles.commentsListContent
                        }
                        showsVerticalScrollIndicator={
                          false
                        }
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode={
                          Platform.OS ===
                          'ios'
                            ? 'interactive'
                            : 'on-drag'
                        }
                        alwaysBounceVertical
                      >
                        {rootComments.map(
                          (
                            comment
                          ) =>
                            renderSheetComment(
                              comment
                            )
                        )}
                      </ScrollView>
                    ) : (
                      <Animated.View
                        style={[
                          styles.commentsEmpty,
                          {
                            opacity:
                              commentsEmptyOpacity,
                            transform: [
                              {
                                translateY:
                                  emptyStateKeyboardTranslateY,
                              },
                            ],
                          },
                        ]}
                      >
                        <Ionicons
                          name="chatbubbles-outline"
                          size={
                            25
                          }
                          color={
                            COLORS.mutedText
                          }
                        />

                        <Text
                          style={
                            styles.commentsEmptyTitle
                          }
                        >
                          No comments yet
                        </Text>

                        <Text
                          style={
                            styles.commentsEmptyText
                          }
                        >
                          Start the conversation.
                        </Text>
                      </Animated.View>
                    )}
                  </Animated.View>
                )}
              </View>

              <KeyboardStickyView
                offset={{
                  closed:
                    0,
                  opened:
                    0,
                }}
              >
                <Animated.View
                  style={[
                    styles.commentsComposerWrap,
                  {
                    paddingBottom:
                      Math.max(
                        insets.bottom +
                          8,
                        20
                      ),
                  },
                ]}
              >
                {editingComment ? (
                  <View
                    style={
                      styles.replyingToRow
                    }
                  >
                    <Text
                      style={
                        styles.replyingToText
                      }
                    >
                      Editing comment
                    </Text>

                    <Pressable
                      onPress={
                        cancelCommentEdit
                      }
                      hitSlop={
                        8
                      }
                    >
                      <Ionicons
                        name="close-circle"
                        size={
                          18
                        }
                        color={
                          COLORS.mutedText
                        }
                      />
                    </Pressable>
                  </View>
                ) : replyTarget ? (
                  <View
                    style={
                      styles.replyingToRow
                    }
                  >
                    <Text
                      style={
                        styles.replyingToText
                      }
                      numberOfLines={
                        1
                      }
                    >
                      Replying to{' '}
                      {replyTarget.author_display_name
                        ?.trim() ||
                        replyTarget.author_username
                          ?.trim() ||
                        'reader'}
                    </Text>

                    <Pressable
                      onPress={
                        resetTemporaryCommentComposer
                      }
                      hitSlop={
                        8
                      }
                    >
                      <Ionicons
                        name="close-circle"
                        size={
                          18
                        }
                        color={
                          COLORS.mutedText
                        }
                      />
                    </Pressable>
                  </View>
                ) : composerResetting ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.replyingToRow,
                      styles.replyingToRowSpacer,
                    ]}
                  >
                    <Text
                      style={
                        styles.replyingToText
                      }
                      numberOfLines={
                        1
                      }
                    >
                      Replying to reader
                    </Text>

                    <View
                      style={
                        styles.replyingToSpacerIcon
                      }
                    />
                  </View>
                ) : null}

                <View
                  style={
                    styles.commentsComposerRow
                  }
                >
                  {composerProfile
                    ?.avatar_url ? (
                    <Image
                      source={{
                        uri:
                          composerProfile.avatar_url,
                      }}
                      style={
                        styles.commentsComposerAvatar
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.commentsComposerAvatarFallback
                      }
                    >
                      <Text
                        style={
                          styles.commentsComposerAvatarText
                        }
                      >
                        {
                          composerAvatarInitial
                        }
                      </Text>
                    </View>
                  )}

                  <View
                    style={
                      styles.commentsComposer
                    }
                  >
                    <TextInput
                      ref={
                        commentInputRef
                      }
                      value={
                        commentBody
                      }
                      onChangeText={
                        setCommentBody
                      }
                      placeholder={
                        composerResetting
                          ? ''
                          : editingComment
                          ? 'Edit your comment…'
                          : replyTarget
                          ? 'Write a reply…'
                          : 'Add a comment…'
                      }
                      placeholderTextColor={
                        COLORS.mutedText
                      }
                      multiline
                      maxLength={
                        2000
                      }
                      style={
                        styles.commentsInput
                      }
                    />

                    <Pressable
                      disabled={
                        !canSubmitComment
                      }
                      onPress={() =>
                        void submitSheetComment()
                      }
                      style={({ pressed }) => [
                        styles.commentsSendButton,
                        !canSubmitComment &&
                          styles.commentsSendButtonDisabled,
                        pressed &&
                          canSubmitComment &&
                          styles.pressed,
                      ]}
                    >
                      {submittingComment ? (
                        <ActivityIndicator
                          size="small"
                          color={
                            COLORS.background
                          }
                        />
                      ) : (
                        <Ionicons
                          name={
                            editingComment
                              ? 'checkmark'
                              : 'arrow-up'
                          }
                          size={
                            18
                          }
                          color={
                            COLORS.background
                          }
                        />
                      )}
                    </Pressable>
                  </View>
                </View>
                </Animated.View>
              </KeyboardStickyView>
                </Animated.View>
              {commentActionTarget ? (
                <View
                  style={
                    styles.longPressCommentActionModal
                  }
                >
                  <Pressable
                    style={
                      StyleSheet.absoluteFill
                    }
                    onPress={() => {
                      resetTemporaryCommentComposer();
                      closeCommentActions();
                    }}
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.longPressCommentActionBackdrop,
                        {
                          opacity:
                            commentActionBackdropOpacity,
                        },
                      ]}
                    />
                  </Pressable>

                  <Animated.View
                    onLayout={(event) => {
                      commentActionSheetHeight.current =
                        event.nativeEvent.layout.height;

                      animateCommentActionsIn();
                    }}
                    style={[
                      styles.longPressCommentActionSheet,
                      {
                        opacity:
                          commentActionSheetOpacity,
                        transform: [
                          {
                            translateY:
                              commentActionTranslateY,
                          },
                        ],
                      },
                    ]}
                  >
            <View
              style={
                styles.longPressCommentActionHandle
              }
            />

            <Text
              style={
                styles.longPressCommentActionTitle
              }
            >
              {commentActionTarget
                ?.is_own
                ? 'Comment options'
                : commentActionTarget
                ? `Comment by ${
                    commentActionTarget
                      .author_display_name
                      ?.trim() ||
                    commentActionTarget
                      .author_username
                      ?.trim() ||
                    'Novori Reader'
                  }`
                : 'Comment options'}
            </Text>

            <Text
              style={
                styles.longPressCommentActionHint
              }
            >
              Choose an action for this comment.
            </Text>

            <View
              style={
                styles.longPressCommentActionList
              }
            >
              <Pressable
                onPress={
                  replyToSelectedComment
                }
                style={({ pressed }) => [
                  styles.longPressCommentActionRow,
                  pressed &&
                    styles.longPressCommentActionRowPressed,
                ]}
              >
                <View
                  style={
                    styles.longPressCommentActionIcon
                  }
                >
                  <Ionicons
                    name="return-down-forward-outline"
                    size={
                      19
                    }
                    color={
                      COLORS.gold
                    }
                  />
                </View>

                <Text
                  style={
                    styles.longPressCommentActionText
                  }
                >
                  Reply
                </Text>
              </Pressable>

              {commentActionTarget
                ?.is_own ? (
                <>
                  <View
                    style={
                      styles.longPressCommentActionDivider
                    }
                  />

                  <Pressable
                    onPress={
                      editSelectedComment
                    }
                    style={({ pressed }) => [
                      styles.longPressCommentActionRow,
                      pressed &&
                        styles.longPressCommentActionRowPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.longPressCommentActionIcon
                      }
                    >
                      <Ionicons
                        name="create-outline"
                        size={
                          19
                        }
                        color={
                          COLORS.gold
                        }
                      />
                    </View>

                    <Text
                      style={
                        styles.longPressCommentActionText
                      }
                    >
                      Edit
                    </Text>
                  </Pressable>

                  <View
                    style={
                      styles.longPressCommentActionDivider
                    }
                  />

                  <Pressable
                    onPress={
                      deleteSelectedComment
                    }
                    style={({ pressed }) => [
                      styles.longPressCommentActionRow,
                      pressed &&
                        styles.longPressCommentActionRowPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.longPressCommentActionIcon,
                        styles.longPressCommentActionDangerIcon,
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={
                          19
                        }
                        color={
                          COLORS.danger
                        }
                      />
                    </View>

                    <Text
                      style={[
                        styles.longPressCommentActionText,
                        styles.longPressCommentActionDangerText,
                      ]}
                    >
                      Delete
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View
                    style={
                      styles.longPressCommentActionDivider
                    }
                  />

                  <Pressable
                    onPress={
                      reportSelectedComment
                    }
                    style={({ pressed }) => [
                      styles.longPressCommentActionRow,
                      pressed &&
                        styles.longPressCommentActionRowPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.longPressCommentActionIcon
                      }
                    >
                      <Ionicons
                        name="flag-outline"
                        size={
                          19
                        }
                        color={
                          COLORS.gold
                        }
                      />
                    </View>

                    <Text
                      style={
                        styles.longPressCommentActionText
                      }
                    >
                      Report
                    </Text>
                  </Pressable>

                  <View
                    style={
                      styles.longPressCommentActionDivider
                    }
                  />

                  <Pressable
                    disabled={
                      Boolean(
                        blockingReaderId
                      )
                    }
                    onPress={
                      confirmBlockSelectedReader
                    }
                    style={({ pressed }) => [
                      styles.longPressCommentActionRow,
                      pressed &&
                        styles.longPressCommentActionRowPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.longPressCommentActionIcon,
                        styles.longPressCommentActionDangerIcon,
                      ]}
                    >
                      <Ionicons
                        name="ban-outline"
                        size={
                          19
                        }
                        color={
                          COLORS.danger
                        }
                      />
                    </View>

                    <Text
                      style={[
                        styles.longPressCommentActionText,
                        styles.longPressCommentActionDangerText,
                      ]}
                    >
                      Block reader
                    </Text>
                  </Pressable>
                </>
              )}
            </View>

            <Pressable
              onPress={() =>
                closeCommentActions()
              }
              style={({ pressed }) => [
                styles.longPressCommentActionCancel,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.longPressCommentActionCancelText
                }
              >
                Cancel
              </Text>
            </Pressable>
                  </Animated.View>
                </View>
              ) : null}

              {commentReportTarget ? (
                <View
                  style={
                    styles.commentReportOverlay
                  }
                >
                  <Pressable
                    style={
                      StyleSheet.absoluteFill
                    }
                    onPress={
                      closeCommentReport
                    }
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.reportBackdropVisual,
                        {
                          opacity:
                            commentReportBackdropOpacity,
                        },
                      ]}
                    />
                  </Pressable>

                  <Animated.View
                    {...commentReportPanResponder.panHandlers}
                    onLayout={(event) => {
                      commentReportSheetHeight.current =
                        event.nativeEvent.layout.height;

                      animateCommentReportIn();
                    }}
                    style={[
                      styles.reportSheet,
                      {
                        paddingBottom:
                          Math.max(
                            18,
                            insets.bottom +
                              12
                          ),
                        opacity:
                          commentReportSheetOpacity,
                        transform: [
                          {
                            translateY:
                              commentReportTranslateY,
                          },
                        ],
                      },
                    ]}
                  >
                    <Pressable
                      onPress={(event) =>
                        event.stopPropagation()
                      }
                    >
                      <View
                        style={
                          styles.reportHandle
                        }
                      />

                      <View
                        style={
                          styles.reportHeadingRow
                        }
                      >
                        <View
                          style={
                            styles.reportHeadingCopy
                          }
                        >
                          <Text
                            style={
                              styles.reportTitle
                            }
                          >
                            Report comment
                          </Text>

                          <Text
                            style={
                              styles.reportSubtitle
                            }
                          >
                            Why are you reporting this comment?
                          </Text>
                        </View>

                        <Pressable
                          onPress={
                            closeCommentReport
                          }
                          hitSlop={
                            10
                          }
                          style={({ pressed }) => [
                            styles.reportCloseButton,
                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          <Ionicons
                            name="close"
                            size={
                              21
                            }
                            color={
                              COLORS.text
                            }
                          />
                        </Pressable>
                      </View>

                      <View
                        style={
                          styles.reportReasonList
                        }
                      >
                        {POST_REPORT_REASONS.map(
                          (
                            reason
                          ) => (
                            <Pressable
                              key={
                                reason.value
                              }
                              disabled={
                                commentReportSubmitting
                              }
                              onPress={() =>
                                void handleCommentReport(
                                  reason.value
                                )
                              }
                              style={({ pressed }) => [
                                styles.reportReasonButton,
                                pressed &&
                                  styles.reportReasonButtonPressed,
                              ]}
                            >
                              <View
                                style={
                                  styles.reportReasonIcon
                                }
                              >
                                <Ionicons
                                  name={
                                    reason.icon
                                  }
                                  size={
                                    18
                                  }
                                  color={
                                    COLORS.gold
                                  }
                                />
                              </View>

                              <Text
                                style={
                                  styles.reportReasonText
                                }
                              >
                                {reason.label}
                              </Text>

                              <Ionicons
                                name="chevron-forward"
                                size={
                                  17
                                }
                                color={
                                  COLORS.mutedText
                                }
                              />
                            </Pressable>
                          )
                        )}
                      </View>

                      <Text
                        style={
                          styles.reportPrivacyText
                        }
                      >
                        Reports are private. The comment author won’t be told who reported them.
                      </Text>

                      {commentReportSubmitting ? (
                        <View
                          style={
                            styles.reportSubmitting
                          }
                        >
                          <ActivityIndicator
                            size="small"
                            color={
                              COLORS.gold
                            }
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  </Animated.View>
                </View>
              ) : null}

              </Animated.View>
            </Animated.View>
          </View>
        <BlockReaderConfirmSheet
        embedded
        visible={
          Boolean(
            blockConfirmTarget
          )
        }
        readerName={
          blockConfirmTarget?.author_display_name
            ?.trim() ||
          blockConfirmTarget?.author_username
            ?.trim() ||
          'this reader'
        }
        busy={
          Boolean(
            blockingReaderId
          )
        }
        onConfirm={() =>
          blockConfirmTarget
            ? blockSelectedReader(
                blockConfirmTarget
              )
            : Promise.resolve()
        }
        onDismissed={() => {
          void finishBlockAfterDismiss();
        }}
        onDismiss={() =>
          setBlockConfirmTarget(
            null
          )
        }
      />
        </View>
      </Modal>

    </>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },
    screen: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: 22,
      paddingBottom: 120,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal: 20,
    },
    topRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
    },
    brandBlock: {
      flex: 1,
      marginTop: 2,
    },
    logo: {
      color:
        COLORS.gold,
      fontSize: 43,
      fontFamily:
        'PlayfairDisplay_700Bold',
      letterSpacing: 0.2,
    },
    slogan: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 15,
      marginTop: 5,
      letterSpacing: 0.15,
    },
    notificationButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginTop: 4,
      marginLeft: 12,
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      position:
        'relative',
    },
    notificationBadge: {
      position:
        'absolute',
      top: -4,
      right: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor:
        COLORS.gold,
      borderWidth: 2,
      borderColor:
        COLORS.background,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    notificationBadgeText: {
      color:
        COLORS.background,
      fontSize: 9,
      fontFamily:
        'Inter_700Bold',
      lineHeight: 12,
    },
    sectionSwitch: {
      flexDirection:
        'row',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 14,
      padding: 4,
      gap: 4,
      marginTop: 24,
      marginBottom: 22,
    },
    sectionSwitchButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    sectionSwitchButtonActive: {
      backgroundColor:
        COLORS.elevated,
    },
    sectionSwitchText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
    },
    sectionSwitchTextActive: {
      color:
        COLORS.gold,
    },
    feedCard: {
      backgroundColor:
        COLORS.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      padding: 21,
    },
    eyebrow: {
      color:
        COLORS.softGold,
      fontSize: 11,
      fontFamily:
        'Inter_700Bold',
      letterSpacing: 1.4,
      marginBottom: 11,
    },
    cardTitle: {
      color:
        COLORS.text,
      fontSize: 24,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      lineHeight: 31,
    },
    cardText: {
      color:
        COLORS.secondaryText,
      fontSize: 15,
      fontFamily:
        'Inter_400Regular',
      lineHeight: 23,
      marginTop: 12,
    },
    clubSearchWrap: {
      minHeight: 48,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 15,
      paddingHorizontal: 13,
      gap: 9,
    },
    clubSearchInput: {
      flex: 1,
      color:
        COLORS.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      paddingVertical: 0,
    },
    clubSearchClear: {
      width: 28,
      height: 28,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    clubSearchHint: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 6,
      marginBottom: 21,
      paddingHorizontal: 3,
    },
    searchResultsHeader: {
      marginBottom: 2,
    },
    searchLoading: {
      minHeight: 150,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    searchEmpty: {
      minHeight: 150,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 17,
      paddingHorizontal: 24,
      marginTop: 13,
    },
    searchEmptyTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
      marginTop: 9,
    },
    searchEmptyText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      textAlign:
        'center',
      marginTop: 4,
    },
    feedLoading: {
      minHeight: 220,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    feedList: {
      gap:
        14,
    },
    feedHeadingRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap: 14,
      marginBottom: 2,
    },
    feedComposeButton: {
      minHeight: 37,
      paddingHorizontal:
        12,
      borderRadius:
        12,
      backgroundColor:
        COLORS.gold,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
    },
    feedComposeButtonText: {
      color:
        COLORS.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    feedEmptyCard: {
      minHeight: 240,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 18,
      paddingHorizontal:
        26,
      paddingVertical:
        30,
    },
    feedEmptyIcon: {
      width: 54,
      height: 54,
      borderRadius: 17,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 12,
    },
    feedEmptyTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 21,
      textAlign:
        'center',
      marginTop: 9,
    },
    feedEmptyText: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      textAlign:
        'center',
      maxWidth: 430,
      marginTop: 7,
    },
    feedActionButton: {
      minHeight: 40,
      borderRadius: 12,
      backgroundColor:
        COLORS.gold,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
      paddingHorizontal:
        14,
      marginTop: 16,
    },
    feedActionButtonText: {
      color:
        COLORS.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    feedPostCard: {
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 22,
      overflow:
        'hidden',
      shadowColor:
        '#000000',
      shadowOpacity:
        0.10,
      shadowRadius:
        14,
      shadowOffset: {
        width:
          0,
        height:
          5,
      },
      elevation:
        3,
    },
    feedPostCardPressed: {
      opacity:
        0.95,
      transform: [
        {
          scale:
            0.998,
        },
      ],
    },
    feedPostHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingHorizontal:
        16,
      paddingTop:
        15,
    },
    feedMoreButton: {
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
      marginLeft:
        4,
      marginTop:
        -2,
    },
    feedAvatar: {
      width:
        46,
      height:
        46,
      borderRadius:
        23,
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      marginRight:
        12,
    },
    feedAvatarFallback: {
      width:
        46,
      height:
        46,
      borderRadius:
        23,
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        12,
    },
    feedAvatarText: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        18,
    },
    feedAuthorCopy: {
      flex:
        1,
      minWidth:
        0,
      paddingTop:
        2,
    },
    feedAuthorLine: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexWrap:
        'nowrap',
      columnGap:
        6,
      minWidth:
        0,
    },
    feedIdentity: {
      flexDirection:
        'row',
      alignItems:
        'center',
      columnGap:
        6,
      flexShrink:
        1,
      minWidth:
        0,
    },
    feedAuthorName: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13.5,
      flexShrink:
        1,
      minWidth:
        0,
    },
    feedUsername: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      flexShrink:
        1,
      minWidth:
        0,
    },
    feedTime: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
    },
    feedAudienceText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        5,
    },
    feedClubLine: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
      marginTop:
        5,
      maxWidth:
        '100%',
    },
    feedClubIcon: {
      width:
        18,
      height:
        18,
      borderRadius:
        6,
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
    },
    feedClubIconFallback: {
      width:
        18,
      height:
        18,
      borderRadius:
        6,
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    feedClubIconText: {
      color:
        COLORS.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        8,
    },
    feedClubText: {
      color:
        COLORS.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
      flexShrink:
        1,
    },
    feedPostContent: {
      paddingHorizontal:
        16,
      paddingTop:
        14,
    },
    feedReadingUpdateLabel: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      marginBottom:
        11,
    },
    feedReadingUpdateLabelText: {
      color:
        COLORS.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10,
      letterSpacing:
        0.9,
    },
    feedReadingBookCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      borderRadius:
        18,
      padding:
        12,
    },
    feedReadingBookCardPressed: {
      opacity:
        0.82,
    },
    feedReadingBookCover: {
      width:
        60,
      height:
        88,
      borderRadius:
        9,
      backgroundColor:
        COLORS.surface,
      marginRight:
        13,
    },
    feedReadingBookCoverFallback: {
      width:
        60,
      height:
        88,
      borderRadius:
        9,
      backgroundColor:
        COLORS.surface,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        13,
    },
    feedReadingBookCopy: {
      flex:
        1,
      minWidth:
        0,
      paddingRight:
        8,
    },
    feedReadingBookTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        15,
      lineHeight:
        20,
    },
    feedReadingProgressPills: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        7,
      marginTop:
        10,
    },
    feedReadingProgressPill: {
      borderRadius:
        999,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.surface,
      paddingHorizontal:
        9,
      paddingVertical:
        5,
    },
    feedReadingProgressPillText: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    feedReadingThoughtWrap: {
      marginTop:
        14,
    },
    feedReadingThought: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        15,
      lineHeight:
        22,
    },
    feedReadingMuted: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        19,
      marginTop:
        12,
    },
    feedBody: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        15,
      lineHeight:
        22,
    },
    feedBookCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      borderRadius:
        16,
      padding:
        11,
      marginTop:
        15,
    },
    feedBookCover: {
      width:
        52,
      height:
        76,
      borderRadius:
        8,
      backgroundColor:
        COLORS.surface,
      marginRight:
        12,
    },
    feedBookCoverFallback: {
      width:
        52,
      height:
        76,
      borderRadius:
        8,
      backgroundColor:
        COLORS.surface,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        12,
    },
    feedBookCopy: {
      flex:
        1,
      minWidth:
        0,
      paddingRight:
        8,
    },
    feedBookEyebrow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      marginBottom:
        5,
    },
    feedBookEyebrowText: {
      color:
        COLORS.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
      textTransform:
        'uppercase',
      letterSpacing:
        0.8,
    },
    feedBookTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      lineHeight:
        18,
    },
    feedBookRatingRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      marginTop:
        7,
    },
    feedBookRating: {
      color:
        COLORS.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11.5,
    },
    feedPostFooter: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        10,
      marginTop:
        15,
      paddingHorizontal:
        16,
      paddingTop:
        12,
      paddingBottom:
        14,
      borderTopWidth:
        1,
      borderTopColor:
        COLORS.border,
    },
    voteControl: {
      flexDirection:
        'row',
      alignItems:
        'center',
      minHeight:
        36,
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      borderRadius:
        18,
      paddingHorizontal:
        4,
    },
    voteButton: {
      width:
        30,
      height:
        34,
      borderRadius:
        17,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    voteButtonActive: {
      backgroundColor:
        COLORS.surface,
    },
    voteButtonDisabled: {
      opacity:
        0.5,
    },
    voteScore: {
      minWidth:
        20,
      textAlign:
        'center',
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    voteScoreActive: {
      color:
        COLORS.gold,
    },
    commentAction: {
      minHeight:
        36,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        6,
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      borderRadius:
        18,
      paddingHorizontal:
        12,
    },
    commentActionText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    clubsLoading: {
      minHeight: 220,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    sectionHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap: 14,
    },
    sectionTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 21,
    },
    sectionSubtitle: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },
    createClubButton: {
      minHeight: 37,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor:
        COLORS.gold,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
    },
    createClubButtonText: {
      color:
        COLORS.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    clubList: {
      gap: 10,
      marginTop: 13,
    },
    compactClubCard: {
      minHeight: 76,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 16,
      padding: 11,
    },
    clubCard: {
      minHeight: 104,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 17,
      padding: 12,
    },
    compactClubImage: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor:
        COLORS.elevated,
      marginRight: 12,
    },
    compactClubImageFallback: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },
    compactClubInitial: {
      color:
        COLORS.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 23,
    },
    clubImage: {
      width: 66,
      height: 66,
      borderRadius: 16,
      backgroundColor:
        COLORS.elevated,
      marginRight: 13,
    },
    clubImageFallback: {
      width: 66,
      height: 66,
      borderRadius: 16,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 13,
    },
    clubInitial: {
      color:
        COLORS.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 28,
    },
    clubCardCopy: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    clubMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
    },
    clubMetaText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
    },
    clubMetaDot: {
      color:
        COLORS.mutedText,
      fontSize: 9,
    },
    clubName: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 15,
      marginTop: 4,
    },
    clubDescription: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },
    clubGenreRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexWrap:
        'wrap',
      gap: 5,
      marginTop: 6,
    },
    clubGenreBadge: {
      backgroundColor:
        COLORS.elevated,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    clubGenreBadgeText: {
      color:
        COLORS.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9,
    },
    clubGenreMore: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9,
    },
    membershipBadge: {
      alignSelf:
        'flex-start',
      backgroundColor:
        COLORS.elevated,
      borderRadius: 9,
      paddingHorizontal: 7,
      paddingVertical: 3,
      marginTop: 5,
    },
    membershipBadgeText: {
      color:
        COLORS.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9,
    },
    emptyClubsCard: {
      minHeight: 96,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 17,
      padding: 14,
      marginTop: 13,
    },
    emptyClubsIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },
    emptyClubsCopy: {
      flex: 1,
      paddingRight: 8,
    },
    emptyClubsTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },
    emptyClubsText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },
    discoverHeader: {
      marginTop: 30,
    },
    clubGenreFilterScroll: {
      marginTop: 12,
      marginHorizontal:
        -20,
    },
    clubGenreFilterRow: {
      paddingHorizontal: 20,
      gap: 8,
    },
    clubGenreFilterChip: {
      minHeight: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.surface,
      paddingHorizontal: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    clubGenreFilterChipActive: {
      borderColor:
        COLORS.gold,
      backgroundColor:
        COLORS.elevated,
    },
    clubGenreFilterText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
    },
    clubGenreFilterTextActive: {
      color:
        COLORS.gold,
    },
    discoverEmpty: {
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 17,
      paddingHorizontal: 24,
      paddingVertical: 28,
      marginTop: 13,
    },
    discoverEmptyTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
      marginTop: 10,
    },
    discoverEmptyText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      textAlign:
        'center',
      marginTop: 4,
    },
    ownPostOptionsBackdrop: {
      flex: 1,
      backgroundColor:
        'transparent',
      justifyContent:
        'flex-end',
    },
    ownPostOptionsBackdropVisual: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.48)',
    },
    ownPostOptionsSheet: {
      width: '100%',
      alignSelf:
        'center',
      backgroundColor:
        COLORS.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 18,
      overflow:
        'hidden',
    },
    ownPostOptionsHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor:
        COLORS.border,
      alignSelf:
        'center',
      marginBottom: 16,
    },
    ownPostOptionsHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    ownPostOptionsHeaderIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    ownPostOptionsHeaderCopy: {
      flex: 1,
    },
    ownPostOptionsTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 20,
    },
    ownPostOptionsSubtitle: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      marginTop: 2,
    },
    ownPostOptionsList: {
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 16,
      overflow:
        'hidden',
      backgroundColor:
        COLORS.background,
    },
    ownPostOptionsRow: {
      minHeight: 66,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 13,
      paddingVertical: 10,
      backgroundColor:
        COLORS.background,
    },
    ownPostOptionsRowPressed: {
      backgroundColor:
        COLORS.elevated,
    },
    ownPostOptionsRowIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },
    ownPostOptionsDangerIcon: {
      backgroundColor:
        'rgba(220, 80, 80, 0.10)',
    },
    ownPostOptionsRowCopy: {
      flex: 1,
      paddingRight: 10,
    },
    ownPostOptionsRowTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },
    ownPostOptionsDangerTitle: {
      color:
        COLORS.danger,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },
    ownPostOptionsRowSubtitle: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      marginTop: 2,
    },
    ownPostOptionsDivider: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        COLORS.border,
      marginLeft: 61,
    },
    ownPostOptionsHint: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      textAlign:
        'center',
      marginTop: 11,
    },
    commentReportOverlay: {
      ...StyleSheet.absoluteFill,
      zIndex:
        200,
      justifyContent:
        'flex-end',
      overflow:
        'hidden',
    },
    explicitContentWrap: {
      position:
        'relative',
      minHeight:
        142,
      overflow:
        'hidden',
      borderRadius:
        16,
      marginTop:
        4,
    },
    explicitContentSource: {
      opacity:
        0.38,
    },
    explicitWarningCard: {
      ...StyleSheet.absoluteFill,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        18,
      paddingVertical:
        14,
      backgroundColor:
        'rgba(68,68,68,0.94)',
      borderWidth:
        1,
      borderColor:
        'rgba(255,255,255,0.10)',
    },
    explicitWarningHeading: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
    },
    explicitWarningTitle: {
      color:
        '#FFFFFF',
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
      lineHeight:
        19,
    },
    explicitWarningText: {
      color:
        '#F2F2F2',
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        17,
      marginTop:
        5,
      textAlign:
        'center',
    },
    explicitWarningActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        10,
      marginTop:
        12,
    },
    explicitWarningButton: {
      minHeight:
        42,
      minWidth:
        108,
      paddingHorizontal:
        18,
      borderRadius:
        21,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
    },
    explicitWarningButtonPrimary: {
      backgroundColor:
        COLORS.gold,
      borderColor:
        COLORS.gold,
    },
    explicitWarningButtonText: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    explicitWarningButtonPrimaryText: {
      color:
        COLORS.background,
    },
    reportBackdrop: {
      flex: 1,
      backgroundColor:
        'transparent',
      justifyContent:
        'flex-end',
    },
    reportBackdropVisual: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.52)',
    },
    reportSheet: {
      width: '100%',
      alignSelf:
        'center',
      backgroundColor:
        COLORS.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 18,
    },
    reportHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor:
        COLORS.border,
      alignSelf:
        'center',
      marginBottom: 13,
    },
    reportHeadingRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      marginBottom: 14,
    },
    reportHeadingCopy: {
      flex: 1,
      paddingRight: 10,
    },
    reportTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 20,
    },
    reportSubtitle: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      marginTop: 3,
    },
    reportCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    reportReasonList: {
      borderRadius: 16,
      overflow:
        'hidden',
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },
    reportReasonButton: {
      minHeight: 54,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 12,
      backgroundColor:
        COLORS.background,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        COLORS.border,
    },
    reportReasonButtonPressed: {
      backgroundColor:
        COLORS.elevated,
    },
    reportReasonIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    reportReasonText: {
      flex: 1,
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
    },
    reportPrivacyText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 12,
      paddingHorizontal: 3,
    },
    reportSubmitting: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.28)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    commentsModalRoot: {
      flex:
        1,
    },
    commentsBackdrop: {
      flex:
        1,
      backgroundColor:
        'transparent',
      overflow:
        'hidden',
    },
    commentsBackdropVisual: {
      ...StyleSheet.absoluteFill,
    },
    commentsBackdropDim: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0, 0, 0, 0.42)',
    },
    commentsBackdropTap: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'transparent',
    },
    commentsEntranceLayer: {
      ...StyleSheet.absoluteFill,
      justifyContent:
        'flex-end',
    },
    commentsSheet: {
      width:
        '100%',
    },
    commentsKeyboardLayer: {
      flex:
        1,
      backgroundColor:
        COLORS.background,
      borderTopLeftRadius:
        26,
      borderTopRightRadius:
        26,
      overflow:
        'hidden',
    },
    commentsDragRegion: {
      zIndex:
        20,
      minHeight:
        66,
      backgroundColor:
        COLORS.background,
      paddingBottom:
        7,
    },
    commentsSheetHandle: {
      alignSelf:
        'center',
      width:
        38,
      height:
        4,
      borderRadius:
        2,
      backgroundColor:
        COLORS.border,
      marginTop:
        9,
      marginBottom:
        5,
    },
    commentsSheetHeader: {
      minHeight:
        38,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        18,
    },
    commentsSheetTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
      textAlign:
        'center',
    },
    commentsMetaRow: {
      minHeight:
        42,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        18,
      gap:
        12,
    },
    commentsIdentityText: {
      flex:
        1,
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      lineHeight:
        20,
    },
    commentsIdentityName: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14.5,
    },
    commentsSortWrap: {
      position:
        'relative',
      zIndex:
        40,
    },
    commentsSortTrigger: {
      minHeight:
        32,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      paddingLeft:
        8,
      paddingRight:
        5,
    },
    commentsSortTriggerText: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11.5,
    },
    commentsSortMenu: {
      position:
        'absolute',
      top:
        34,
      right:
        0,
      width:
        202,
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.elevated,
      shadowColor:
        '#000000',
      shadowOpacity:
        0.18,
      shadowRadius:
        14,
      shadowOffset: {
        width:
          0,
        height:
          6,
      },
      elevation:
        8,
      overflow:
        'hidden',
    },
    commentsSortMenuItem: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        12,
      paddingVertical:
        9,
    },
    commentsSortMenuItemPressed: {
      opacity:
        0.72,
    },
    commentsSortMenuCheck: {
      width:
        23,
      alignItems:
        'flex-start',
    },
    commentsSortMenuCopy: {
      flex:
        1,
    },
    commentsSortMenuTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    commentsSortMenuSubtitle: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        9.5,
      marginTop:
        2,
    },
    commentsSortMenuDivider: {
      height:
        StyleSheet.hairlineWidth,
      marginLeft:
        35,
      backgroundColor:
        COLORS.border,
    },
    commentsSideRail: {
      position:
        'absolute',
      top:
        72,
      bottom:
        78,
      zIndex:
        60,
      backgroundColor:
        'transparent',
    },
    commentsSideRailLeft: {
      left:
        0,
      width:
        38,
    },
    commentsSideRailRight: {
      right:
        0,
      width:
        38,
    },
    commentsListWrap: {
      flex:
        1,
      minHeight:
        0,
    },
    commentsResultLayer: {
      flex:
        1,
      minHeight:
        0,
    },
    commentsList: {
      flex:
        1,
    },
    commentsListContent: {
      paddingLeft:
        24,
      paddingRight:
        38,
      paddingTop:
        14,
      paddingBottom:
        18,
      gap:
        13,
    },
    commentsLoading: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    commentsEmpty: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        28,
    },
    commentsEmptyTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      marginTop:
        8,
    },
    commentsEmptyText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      marginTop:
        3,
    },
    sheetCommentThread: {
      gap:
        7,
    },
    sheetComment: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      borderWidth:
        1,
      borderColor:
        'transparent',
      borderRadius:
        14,
      paddingHorizontal:
        6,
      paddingVertical:
        5,
      marginHorizontal:
        -6,
      marginVertical:
        -5,
    },
    sheetCommentActionAccent: {
      position:
        'absolute',
      left:
        -1,
      top:
        7,
      bottom:
        7,
      width:
        3,
      borderRadius:
        2,
      backgroundColor:
        COLORS.gold,
      zIndex:
        2,
    },
    commentHoldTarget: {
      alignSelf:
        'stretch',
      borderRadius:
        10,
    },
    sheetCommentPressed: {
      backgroundColor:
        COLORS.elevated,
    },
    sheetCommentAvatarButton: {
      marginRight:
        9,
    },
    sheetCommentAvatar: {
      width:
        34,
      height:
        34,
      borderRadius:
        17,
      backgroundColor:
        COLORS.elevated,
    },
    sheetCommentAvatarFallback: {
      width:
        34,
      height:
        34,
      borderRadius:
        17,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    sheetCommentAvatarText: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        13,
    },
    sheetCommentCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    sheetCommentIdentity: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      minWidth:
        0,
    },
    sheetCommentNameButton: {
      flexShrink:
        1,
      minHeight:
        24,
      justifyContent:
        'center',
    },
    sheetCommentName: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
      flexShrink:
        1,
    },
    sheetCommentUsername: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      flexShrink:
        1,
    },
    sheetCommentTime: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      flexShrink:
        0,
    },
    sheetCommentBody: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      lineHeight:
        20,
      marginTop:
        3,
    },
    sheetCommentActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        16,
      marginTop:
        6,
    },
    commentVoteControl: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        0,
    },
    commentVoteButton: {
      width:
        28,
      height:
        28,
      borderRadius:
        14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    commentVoteButtonActive: {
      backgroundColor:
        COLORS.elevated,
    },
    commentVoteScore: {
      minWidth:
        18,
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
      textAlign:
        'center',
    },
    commentVoteScoreActive: {
      color:
        COLORS.gold,
    },
    sheetReplyButton: {
      minHeight:
        28,
      justifyContent:
        'center',
    },
    sheetReplyText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    sheetDeleteButton: {
      minHeight:
        22,
      justifyContent:
        'center',
    },
    sheetDeleteText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
    },
    sheetReportButton: {
      minHeight:
        28,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    sheetReportText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    sheetReplies: {
      gap:
        8,
    },
    viewMoreRepliesButton: {
      minHeight:
        25,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
      marginLeft:
        43,
    },
    replyGuide: {
      width:
        20,
      height:
        1,
      backgroundColor:
        COLORS.border,
    },
    viewMoreRepliesText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9,
    },
    commentsComposerWrap: {
      backgroundColor:
        COLORS.background,
      paddingHorizontal:
        14,
      paddingTop:
        11,
    },
    commentsComposerRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      gap:
        10,
    },
    commentsComposerAvatar: {
      width:
        42,
      height:
        42,
      borderRadius:
        21,
      backgroundColor:
        COLORS.elevated,
      marginBottom:
        5,
    },
    commentsComposerAvatarFallback: {
      width:
        42,
      height:
        42,
      borderRadius:
        21,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        5,
    },
    commentsComposerAvatarText: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        16,
    },
    replyingToRow: {
      minHeight:
        24,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        4,
      paddingBottom:
        5,
    },
    replyingToText: {
      flex:
        1,
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        9,
      marginRight:
        8,
    },
    replyingToRowSpacer: {
      opacity:
        0,
    },
    replyingToSpacerIcon: {
      width:
        18,
      height:
        18,
    },
    commentsComposer: {
      flex:
        1,
      minHeight:
        52,
      maxHeight:
        122,
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      backgroundColor:
        COLORS.surface,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      borderRadius:
        20,
      paddingLeft:
        14,
      paddingRight:
        5,
      paddingVertical:
        5,
    },
    commentsInput: {
      flex:
        1,
      minHeight:
        40,
      maxHeight:
        108,
      color:
        COLORS.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        15,
      lineHeight:
        20,
      paddingTop:
        10,
      paddingBottom:
        9,
      paddingRight:
        8,
    },
    commentsSendButton: {
      width:
        40,
      height:
        40,
      borderRadius:
        20,
      backgroundColor:
        COLORS.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    commentsSendButtonDisabled: {
      opacity:
        0.35,
    },
    blockedCommentCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.elevated,
      borderRadius:
        14,
      paddingHorizontal:
        12,
      paddingVertical:
        11,
      marginVertical:
        4,
    },
    blockedCommentIcon: {
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
        COLORS.surface,
      marginRight:
        10,
    },
    blockedCommentCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    blockedCommentTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    blockedCommentText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      marginTop:
        2,
    },
    pressed: {
      opacity: 0.68,
    },
    longPressCommentActionModal: {
      ...StyleSheet.absoluteFill,
      justifyContent:
        'flex-end',
      borderTopLeftRadius:
        26,
      borderTopRightRadius:
        26,
      overflow:
        'hidden',
      zIndex:
        80,
      elevation:
        80,
    },
    longPressCommentActionBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.42)',
      borderTopLeftRadius:
        26,
      borderTopRightRadius:
        26,
    },
    longPressCommentActionSheet: {
      width:
        '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      backgroundColor:
        COLORS.surface,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      paddingHorizontal:
        16,
      paddingTop:
        10,
      paddingBottom:
        24,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
    },
    longPressCommentActionHandle: {
      width:
        42,
      height:
        4,
      borderRadius:
        2,
      backgroundColor:
        COLORS.border,
      alignSelf:
        'center',
      marginBottom:
        15,
    },
    longPressCommentActionTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
      textAlign:
        'center',
    },
    longPressCommentActionHint: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      textAlign:
        'center',
      marginTop:
        4,
      marginBottom:
        14,
    },
    longPressCommentActionList: {
      borderRadius:
        16,
      overflow:
        'hidden',
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.background,
    },
    longPressCommentActionRow: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        13,
      backgroundColor:
        COLORS.background,
    },
    longPressCommentActionRowPressed: {
      backgroundColor:
        COLORS.elevated,
    },
    longPressCommentActionIcon: {
      width:
        36,
      height:
        36,
      borderRadius:
        12,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        12,
    },
    longPressCommentActionDangerIcon: {
      backgroundColor:
        'rgba(220,80,80,0.10)',
    },
    longPressCommentActionText: {
      flex:
        1,
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14,
    },
    longPressCommentActionDangerText: {
      color:
        COLORS.danger,
    },
    longPressCommentActionDivider: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        COLORS.border,
      marginLeft:
        61,
    },
    longPressCommentActionCancel: {
      minHeight:
        48,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        12,
      borderRadius:
        14,
      backgroundColor:
        COLORS.elevated,
    },
    longPressCommentActionCancelText: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
  });
