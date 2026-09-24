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
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

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
} from '../../lib/comments';
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

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        260
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

  const commentsKeyboardTranslateY =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const [
    commentsKeyboardInset,
    setCommentsKeyboardInset,
  ] =
    useState(0);

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
          ]);

        const [
          attentionResult,
          myClubsResult,
          discoverResult,
          feedResult,
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

            Animated.timing(
              commentsKeyboardTranslateY,
              {
                toValue:
                  -overlap,
                duration:
                  Math.max(
                    120,
                    event.duration ??
                      250
                  ),
                easing:
                  Easing.bezier(
                    0.25,
                    0.1,
                    0.25,
                    1
                  ),
                useNativeDriver:
                  true,
              }
            ).start();

          }
        );

      const show =
        Keyboard.addListener(
          'keyboardWillShow',
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

            commentsEmptyOpacity.stopAnimation();

            Animated.timing(
              commentsEmptyOpacity,
              {
                toValue:
                  0,
                duration:
                  75,
                easing:
                  Easing.out(
                    Easing.quad
                  ),
                useNativeDriver:
                  true,
              }
            ).start(() => {
              setCommentsKeyboardInset(
                overlap
              );

              requestAnimationFrame(
                () => {
                  Animated.timing(
                    commentsEmptyOpacity,
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
                  ).start();
                }
              );
            });
          }
        );

      const hide =
        Keyboard.addListener(
          'keyboardWillHide',
          (
            event
          ) => {
            setCommentsKeyboardVisible(
              false
            );

            commentsEmptyOpacity.stopAnimation();

            Animated.timing(
              commentsEmptyOpacity,
              {
                toValue:
                  0,
                duration:
                  75,
                easing:
                  Easing.out(
                    Easing.quad
                  ),
                useNativeDriver:
                  true,
              }
            ).start(() => {
              setCommentsKeyboardInset(
                0
              );

              requestAnimationFrame(
                () => {
                  Animated.timing(
                    commentsEmptyOpacity,
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
                  ).start();
                }
              );
            });

            Animated.timing(
              commentsKeyboardTranslateY,
              {
                toValue:
                  0,
                duration:
                  Math.max(
                    120,
                    event.duration ??
                      220
                  ),
                easing:
                  Easing.bezier(
                    0.25,
                    0.1,
                    0.25,
                    1
                  ),
                useNativeDriver:
                  true,
              }
            ).start();

          }
        );

      return () => {
        changeFrame.remove();
        show.remove();
        hide.remove();
      };
    },
    [
      commentsEmptyOpacity,
      commentsKeyboardTranslateY,
      windowHeight,
    ]
  );

  useEffect(
    () => {
      if (
        !commentsModalVisible ||
        !commentsInitialLoadReady ||
        !commentsSheetEntranceReady
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
            240,
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
      commentsSheetEntranceReady,
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
      loadHomeData(true);
      void loadComposerProfile();
    }, [
      loadComposerProfile,
      loadHomeData,
    ])
  );

  useEffect(() => {
    let active =
      true;

    let channel:
      ReturnType<
        typeof supabase.channel
      > | null =
      null;

    async function subscribeToNotificationCount() {
      const {
        data: {
          user,
        },
        error,
      } =
        await supabase.auth.getUser();

      if (
        error ||
        !user ||
        !active
      ) {
        return;
      }

      const refreshAttentionCount =
        async () => {
          try {
            const count =
              await getNotificationAttentionCount();

            if (
              active
            ) {
              setAttentionCount(
                count
              );
            }
          } catch (
            attentionError
          ) {
            console.error(
              'Could not refresh realtime notification attention count:',
              attentionError
            );
          }
        };

      channel =
        supabase
          .channel(
            `home-notification-count-${user.id}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`
          )
          .on(
            'postgres_changes',
            {
              event:
                '*',
              schema:
                'public',
              table:
                'notifications',
              filter:
                `recipient_id=eq.${user.id}`,
            },
            () => {
              void refreshAttentionCount();
            }
          )
          .subscribe();
    }

    void subscribeToNotificationCount();

    return () => {
      active =
        false;

      if (
        channel
      ) {
        void supabase.removeChannel(
          channel
        );
      }
    };
  }, []);

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
    commentsKeyboardTranslateY.stopAnimation();
    commentsContentOpacity.stopAnimation();
    commentsResultOpacity.stopAnimation();
    commentsEmptyOpacity.stopAnimation();

    commentsResultOpacity.setValue(
      0
    );
    commentsEmptyOpacity.setValue(
      1
    );
    setCommentsKeyboardInset(
      0
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
    commentsKeyboardTranslateY.setValue(
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
      Animated.sequence([
        Animated.delay(
          70
        ),
        Animated.timing(
          commentsContentOpacity,
          {
            toValue:
              1,
            duration:
              110,
            easing:
              Easing.out(
                Easing.cubic
              ),
            useNativeDriver:
              true,
          }
        ),
      ]),
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
    setCommentsKeyboardInset(
      0
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
    commentsKeyboardTranslateY.setValue(
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
      commentsKeyboardVisible
    ) {
      Keyboard.dismiss();
      return;
    }

    closeCommentsSheet();
  }

  function closeCommentsSheet() {
    if (
      commentsSheetAnimating.current
    ) {
      return;
    }

    Keyboard.dismiss();

    commentsSheetAnimating.current =
      true;

    commentsSheetHeight.stopAnimation();
    commentsBackdropOpacity.stopAnimation();
    commentsKeyboardTranslateY.stopAnimation();
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
      Animated.timing(
        commentsKeyboardTranslateY,
        {
          toValue:
            0,
          duration:
            150,
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

  function startReply(
    comment:
      PostComment
  ) {
    setReplyTarget(
      comment
    );

    setTimeout(
      () => {
        commentInputRef
          .current
          ?.focus();
      },
      75
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
            styles.sheetComment
          }
        >
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

            <Text
              style={
                styles.sheetCommentBody
              }
            >
              {comment.body}
            </Text>

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
                      19
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
                      19
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

              <Pressable
                onPress={() =>
                  startReply(
                    comment
                  )
                }
                hitSlop={
                  8
                }
                style={({ pressed }) => [
                  styles.sheetReplyButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.sheetReplyText
                  }
                >
                  Reply
                </Text>
              </Pressable>

              {comment.is_own ? (
                <Pressable
                  disabled={
                    deletingCommentId ===
                    comment.id
                  }
                  onPress={() =>
                    confirmDeleteComment(
                      comment
                    )
                  }
                  hitSlop={
                    8
                  }
                  style={({ pressed }) => [
                    styles.sheetDeleteButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {deletingCommentId ===
                  comment.id ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        COLORS.mutedText
                      }
                    />
                  ) : (
                    <Text
                      style={
                        styles.sheetDeleteText
                      }
                    >
                      Delete
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  onPress={() =>
                    openCommentReport(
                      comment
                    )
                  }
                  hitSlop={
                    8
                  }
                  style={({ pressed }) => [
                    styles.sheetReportButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.sheetReportText
                    }
                  >
                    Report
                  </Text>
                </Pressable>
              )}
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
    reportBackdropOpacity.stopAnimation();

    reportTranslateY.setValue(
      reportEntranceOffset
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
    if (reportEntranceStarted.current || !reportModalShown.current || !reportSheetHeight.current ||
        reportSheetAnimating.current || reportSheetClosing.current) {
      return;
    }
    reportTranslateY.stopAnimation();
    reportBackdropOpacity.stopAnimation();

    reportSheetAnimating.current =
      true;

    reportEntranceStarted.current = true;
    reportTranslateY.setValue(reportSheetHeight.current + 24);
    reportSheetOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(
        reportTranslateY,
        {
          toValue: 0,
          duration: 320,
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
        reportBackdropOpacity,
        {
          toValue: 1,
          duration: 320,
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
    if (reportSheetClosing.current) {
      return;
    }
    reportSheetClosing.current = true;

    reportTranslateY.stopAnimation();
    reportBackdropOpacity.stopAnimation();

    reportSheetAnimating.current =
      true;

    Animated.parallel([
      Animated.timing(
        reportTranslateY,
        {
          toValue:
            reportSheetHeight.current + 24,
          duration: 245,
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
        reportBackdropOpacity,
        {
          toValue: 0,
          duration: 245,
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
        setReportTargetPost(
          null
        );

        // Do not reset the translation while the native modal is dismissing:
        // doing so briefly exposes the sheet again over the undimmed feed.
        if (Platform.OS !== 'ios') {
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
    ownPostOptionsBackdropOpacity.stopAnimation();

    ownPostOptionsTranslateY.setValue(
      260
    );
    ownPostOptionsBackdropOpacity.setValue(
      0
    );

    setOwnPostOptionsTarget(
      post
    );
  }

  function animateOwnPostOptionsIn() {
    Animated.parallel([
      Animated.timing(
        ownPostOptionsTranslateY,
        {
          toValue: 0,
          duration: 260,
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
        ownPostOptionsBackdropOpacity,
        {
          toValue: 1,
          duration: 180,
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
    ownPostOptionsBackdropOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(
        ownPostOptionsTranslateY,
        {
          toValue: 260,
          duration: 210,
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
        ownPostOptionsBackdropOpacity,
        {
          toValue: 0,
          duration: 170,
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

        <Text
          style={
            styles.feedBody
          }
        >
          {post.body}
        </Text>

        {post.book_title ? (
          <View
            style={
              styles.feedBookCard
            }
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
                    19
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
                <Text
                  style={
                    styles.feedBookRating
                  }
                >
                  ★{' '}
                  {
                    post.rating
                  }
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

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
                15
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
                0}
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
        onRequestClose={
          closeCommentsSheet
        }
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
                onTouchStart={() => {
                  if (
                    commentsKeyboardVisible
                  ) {
                    Keyboard.dismiss();
                  }
                }}
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
                style={[
                  styles.commentsSideRail,
                  styles.commentsSideRailLeft,
                ]}
              />

              <View
                {...commentsSheetPanResponder.panHandlers}
                style={[
                  styles.commentsSideRail,
                  styles.commentsSideRailRight,
                ]}
              />

              <View
                onTouchStart={() => {
                  if (
                    commentsKeyboardVisible
                  ) {
                    Keyboard.dismiss();
                  }
                }}
                style={[
                  styles.commentsListWrap,
                  {
                    marginBottom:
                      commentsKeyboardInset,
                  },
                ]}
              >
                {!commentsInitialLoadReady ||
                !commentsSheetEntranceReady ? (
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
                        style={
                          styles.commentsList
                        }
                        contentContainerStyle={
                          styles.commentsListContent
                        }
                        showsVerticalScrollIndicator={
                          false
                        }
                        keyboardShouldPersistTaps="never"
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
                    transform: [
                      {
                        translateY:
                          commentsKeyboardTranslateY,
                      },
                    ],
                  },
                ]}
              >
                {replyTarget ? (
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
                      onPress={() =>
                        setReplyTarget(
                          null
                        )
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
                        replyTarget
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
                          name="arrow-up"
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
                </Animated.View>
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
      gap: 12,
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
      borderRadius: 18,
      padding: 15,
    },
    feedPostCardPressed: {
      opacity: 0.92,
    },
    feedPostHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
    },
    feedMoreButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginLeft: 4,
      marginTop: -3,
    },
    feedAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        COLORS.elevated,
      marginRight: 11,
    },
    feedAvatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    feedAvatarText: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
    },
    feedAuthorCopy: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
    },
    feedAuthorLine: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexWrap:
        'nowrap',
      columnGap: 5,
      minWidth: 0,
    },
    feedIdentity: {
      flexDirection:
        'row',
      alignItems:
        'center',
      columnGap: 5,
      flexShrink: 1,
      minWidth: 0,
    },
    feedAuthorName: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
      flexShrink: 1,
      minWidth: 0,
    },
    feedUsername: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      flexShrink: 1,
      minWidth: 0,
    },
    feedTime: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
    },
    feedAudienceText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 4,
    },
    feedClubLine: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
      marginTop: 4,
      maxWidth: '100%',
    },
    feedClubIcon: {
      width: 17,
      height: 17,
      borderRadius: 5,
      backgroundColor:
        COLORS.elevated,
    },
    feedClubIconFallback: {
      width: 17,
      height: 17,
      borderRadius: 5,
      backgroundColor:
        COLORS.elevated,
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
      fontSize: 8,
    },
    feedClubText: {
      color:
        COLORS.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
      flexShrink: 1,
    },
    feedBody: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 13,
    },
    feedBookCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.elevated,
      borderRadius: 13,
      padding: 9,
      marginTop: 13,
    },
    feedBookCover: {
      width: 39,
      height: 57,
      borderRadius: 6,
      backgroundColor:
        COLORS.surface,
      marginRight: 10,
    },
    feedBookCoverFallback: {
      width: 39,
      height: 57,
      borderRadius: 6,
      backgroundColor:
        COLORS.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },
    feedBookCopy: {
      flex: 1,
    },
    feedBookTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 17,
    },
    feedBookRating: {
      color:
        COLORS.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      marginTop: 4,
    },
    feedPostFooter: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderTopWidth: 1,
      borderTopColor:
        COLORS.border,
      marginTop: 13,
      paddingTop: 10,
    },
    voteControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    voteButton: {
      width: 26,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voteButtonActive: {
      backgroundColor: COLORS.elevated,
    },
    voteButtonDisabled: {
      opacity: 0.5,
    },
    voteScore: {
      minWidth: 14,
      textAlign: 'center',
      color: COLORS.mutedText,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
    },
    voteScoreActive: {
      color: COLORS.gold,
    },
    commentAction: {
      minWidth: 34,
      height: 32,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'flex-end',
      gap: 5,
      paddingLeft: 6,
    },
    commentActionText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
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
    pressed: {
      opacity: 0.68,
    },
  });
