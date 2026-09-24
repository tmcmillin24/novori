import { Ionicons } from '@expo/vector-icons';
import {
    useFocusEffect,
    useLocalSearchParams,
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
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
import {
    CommentVoteValue,
    createPostComment,
    deletePostComment,
    getPostComments,
    PostComment,
    toggleCommentVote,
} from '../../lib/comments';
import {
    FeedPost,
    getPostDetail,
    PostVoteValue,
    togglePostVote,
} from '../../lib/feed';

type ThreadComment =
  PostComment & {
    children:
      ThreadComment[];
  };

type ReplyTarget = {
  id: string;
  name: string;
};

function formatRelativeTime(
  value: string
) {
  const difference =
    Date.now() -
    new Date(
      value
    ).getTime();

  const minute =
    60 * 1000;

  const hour =
    60 * minute;

  const day =
    24 * hour;

  if (
    difference <
    minute
  ) {
    return 'now';
  }

  if (
    difference <
    hour
  ) {
    return `${Math.max(
      1,
      Math.floor(
        difference /
          minute
      )
    )}m`;
  }

  if (
    difference <
    day
  ) {
    return `${Math.floor(
      difference /
        hour
    )}h`;
  }

  if (
    difference <
    7 * day
  ) {
    return `${Math.floor(
      difference /
        day
    )}d`;
  }

  return new Date(
    value
  ).toLocaleDateString(
    undefined,
    {
      month:
        'short',
      day:
        'numeric',
    }
  );
}

export default function PostDetailScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      id?: string;
      commentId?: string;
    }>();

  const postId =
    typeof params.id ===
    'string'
      ? params.id
      : '';

  const targetCommentId =
    typeof params.commentId ===
    'string'
      ? params.commentId
      : '';

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    post,
    setPost,
  ] =
    useState<
      FeedPost | null
    >(null);

  const [
    comments,
    setComments,
  ] =
    useState<
      PostComment[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    voting,
    setVoting,
  ] =
    useState(false);

  const [
    commentBody,
    setCommentBody,
  ] =
    useState('');

  const [
    replyTo,
    setReplyTo,
  ] =
    useState<
      ReplyTarget | null
    >(null);

  const [
    submitting,
    setSubmitting,
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

  const [
    highlightedCommentId,
    setHighlightedCommentId,
  ] =
    useState<
      string | null
    >(null);

  const scrollRef =
    useRef<ScrollView>(
      null
    );

  const scrollYRef =
    useRef(0);

  const commentRefs =
    useRef<
      Record<
        string,
        View | null
      >
    >({});

  const loadData =
    useCallback(
      async (
        showLoader =
          true
      ) => {
        if (
          !postId
        ) {
          setError(
            'This post could not be found.'
          );
          setLoading(
            false
          );
          return;
        }

        try {
          if (
            showLoader
          ) {
            setLoading(
              true
            );
          }

          setError(
            ''
          );

          const [
            postData,
            commentData,
          ] =
            await Promise.all([
              getPostDetail(
                postId
              ),
              getPostComments(
                postId
              ),
            ]);

          setPost(
            postData
          );

          setComments(
            commentData
          );
        } catch (
          loadError
        ) {
          console.error(
            'Could not load post thread:',
            loadError
          );

          setError(
            'This post is unavailable or you no longer have access to it.'
          );
        } finally {
          if (
            showLoader
          ) {
            setLoading(
              false
            );
          }
        }
      },
      [
        postId,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        loadData(
          true
        );
      },
      [
        loadData,
      ]
    )
  );

  useEffect(
    () => {
      if (
        !targetCommentId ||
        !comments.some(
          (
            comment
          ) =>
            comment.id ===
            targetCommentId
        )
      ) {
        return;
      }

      setHighlightedCommentId(
        targetCommentId
      );

      const scrollTimer =
        setTimeout(
          () => {
            const target =
              commentRefs.current[
                targetCommentId
              ];

            const scroll =
              scrollRef.current;

            if (
              !target ||
              !scroll
            ) {
              return;
            }

            target.measureInWindow(
              (
                _x,
                targetY
              ) => {
                scroll.getNativeScrollRef()?.measureInWindow(
                  (
                    _scrollX,
                    scrollY
                  ) => {
                    scroll.scrollTo({
                      y:
                        Math.max(
                          0,
                          scrollYRef.current +
                            targetY -
                            scrollY -
                            90
                        ),
                      animated:
                        true,
                    });
                  }
                );
              }
            );
          },
          450
        );

      const highlightTimer =
        setTimeout(
          () => {
            setHighlightedCommentId(
              (
                current
              ) =>
                current ===
                targetCommentId
                  ? null
                  : current
            );
          },
          2400
        );

      return () => {
        clearTimeout(
          scrollTimer
        );

        clearTimeout(
          highlightTimer
        );
      };
    },
    [
      targetCommentId,
      comments,
      commentSort,
    ]
  );

  const thread =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            ThreadComment
          >();

        for (
          const comment
          of comments
        ) {
          map.set(
            comment.id,
            {
              ...comment,
              children:
                [],
            }
          );
        }

        const roots:
          ThreadComment[] =
          [];

        for (
          const comment
          of comments
        ) {
          const node =
            map.get(
              comment.id
            );

          if (
            !node
          ) {
            continue;
          }

          if (
            comment.parent_comment_id &&
            map.has(
              comment.parent_comment_id
            )
          ) {
            map
              .get(
                comment.parent_comment_id
              )!
              .children.push(
                node
              );
          } else {
            roots.push(
              node
            );
          }
        }

        function sortNodes(
          nodes:
            ThreadComment[]
        ):
          ThreadComment[] {
          return [
            ...nodes,
          ]
            .sort(
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
            )
            .map(
              (
                node
              ) => ({
                ...node,
                children:
                  sortNodes(
                    node.children
                  ),
              })
            );
        }

        return sortNodes(
          roots
        );
      },
      [
        comments,
        commentSort,
      ]
    );


  async function refresh() {
    try {
      setRefreshing(
        true
      );

      await loadData(
        false
      );
    } finally {
      setRefreshing(
        false
      );
    }
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

  function openClub(
    clubId: string
  ) {
    router.push({
      pathname:
        '/club/[id]',
      params: {
        id:
          clubId,
      },
    });
  }

  async function handleVote(
    voteValue:
      PostVoteValue
  ) {
    if (
      !post ||
      voting
    ) {
      return;
    }

    try {
      setVoting(
        true
      );

      const nextVote =
        await togglePostVote(
          post.id,
          voteValue
        );

      setPost(
        (
          current
        ) =>
          current
            ? {
                ...current,
                ...nextVote,
              }
            : current
      );
    } catch (
      voteError
    ) {
      console.error(
        'Could not update post vote:',
        voteError
      );

      Alert.alert(
        'Could not vote',
        'Please try again.'
      );
    } finally {
      setVoting(
        false
      );
    }
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
          (
            nextVote -
            previousVote
          ),
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

    setComments(
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

      setComments(
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
      voteError
    ) {
      console.error(
        'Could not update comment vote:',
        voteError
      );

      setComments(
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

  async function submitComment() {
    if (
      !post ||
      submitting
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

    const postIdForComment =
      post.id;

    const parentId =
      replyTo?.id ??
      null;

    const optimisticId =
      `optimistic-${Date.now()}`;

    const optimisticComment:
      PostComment = {
        id:
          optimisticId,
        post_id:
          postIdForComment,
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

    const previousReply =
      replyTo;

    setComments(
      (
        current
      ) => [
        ...current,
        optimisticComment,
      ]
    );

    setPost(
      (
        current
      ) =>
        current
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

    setReplyTo(
      null
    );

    try {
      setSubmitting(
        true
      );

      await createPostComment(
        postIdForComment,
        cleaned,
        parentId
      );

      const nextComments =
        await getPostComments(
          postIdForComment
        );

      setComments(
        nextComments
      );

      setPost(
        (
          current
        ) =>
          current
            ? {
                ...current,
                comment_count:
                  nextComments.length,
              }
            : current
      );
    } catch (
      submitError
    ) {
      console.error(
        'Could not add comment:',
        submitError
      );

      setComments(
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

      setPost(
        (
          current
        ) =>
          current
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

      setReplyTo(
        previousReply
      );

      Alert.alert(
        'Could not comment',
        submitError instanceof Error
          ? submitError.message
          : 'Please try again.'
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  function confirmDelete(
    comment:
      ThreadComment
  ) {
    Alert.alert(
      'Delete comment?',
      comment.children.length >
        0
        ? 'This will also remove replies underneath this comment.'
        : 'This comment will be permanently removed.',
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
            removeComment(
              comment.id
            ),
        },
      ]
    );
  }

  async function removeComment(
    commentId: string
  ) {
    if (
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
        replyTo?.id ===
        commentId
      ) {
        setReplyTo(
          null
        );
      }

      await loadData(
        false
      );
    } catch (
      deleteError
    ) {
      console.error(
        'Could not delete comment:',
        deleteError
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

  function renderComment(
    comment:
      ThreadComment,
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
        ref={(
          node
        ) => {
          commentRefs.current[
            comment.id
          ] =
            node;
        }}
        style={[
          styles.commentThread,
          {
            marginLeft:
              visualDepth *
              17,
          },
        ]}
      >
        <View
          style={[
            styles.commentCard,
            highlightedCommentId ===
              comment.id &&
              styles.commentCardHighlighted,
          ]}
        >
          <View
            style={
              styles.commentHeader
            }
          >
            <Pressable
              onPress={() =>
                openReader(
                  comment.author_id
                )
              }
              style={({ pressed }) => [
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
                    styles.commentAvatar
                  }
                />
              ) : (
                <View
                  style={
                    styles.commentAvatarFallback
                  }
                >
                  <Text
                    style={
                      styles.commentAvatarText
                    }
                  >
                    {initial}
                  </Text>
                </View>
              )}
            </Pressable>

            <View
              style={
                styles.commentAuthorCopy
              }
            >
              <Pressable
                onPress={() =>
                  openReader(
                    comment.author_id
                  )
                }
                style={({ pressed }) => [
                  pressed &&
                    styles.pressed,
                ]}
              >
                <View
                  style={
                    styles.commentIdentity
                  }
                >
                  <Text
                    style={
                      styles.commentAuthorName
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {displayName}
                  </Text>

                  {username ? (
                    <Text
                      style={
                        styles.commentUsername
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {username}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <Text
                style={
                  styles.commentTime
                }
              >
                {formatRelativeTime(
                  comment.created_at
                )}
              </Text>
            </View>

            {comment.is_own ? (
              <Pressable
                disabled={
                  deletingCommentId ===
                  comment.id
                }
                onPress={() =>
                  confirmDelete(
                    comment
                  )
                }
                hitSlop={
                  8
                }
                style={({ pressed }) => [
                  styles.commentDelete,
                  pressed &&
                    styles.pressed,
                ]}
              >
                {deletingCommentId ===
                comment.id ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.mutedText
                    }
                  />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={
                      15
                    }
                    color={
                      colors.mutedText
                    }
                  />
                )}
              </Pressable>
            ) : null}
          </View>

          <Text
            style={
              styles.commentBody
            }
          >
            {comment.body}
          </Text>

          <View
            style={
              styles.commentFooter
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
                    16
                  }
                  color={
                    comment.viewer_vote ===
                    1
                      ? colors.gold
                      : colors.mutedText
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
                    16
                  }
                  color={
                    comment.viewer_vote ===
                    -1
                      ? colors.gold
                      : colors.mutedText
                  }
                />
              </Pressable>
            </View>

            <Pressable
              onPress={() =>
                setReplyTo({
                  id:
                    comment.id,
                  name:
                    displayName,
                })
              }
              hitSlop={
                8
              }
              style={({ pressed }) => [
                styles.replyButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="return-down-forward-outline"
                size={
                  14
                }
                color={
                  colors.mutedText
                }
              />

              <Text
                style={
                  styles.replyButtonText
                }
              >
                Reply
              </Text>
            </Pressable>
          </View>
        </View>

        {comment.children.map(
          (
            child
          ) =>
            renderComment(
              child,
              depth + 1
            )
        )}
      </View>
    );
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
        </View>
      </SafeAreaView>
    );
  }

  if (
    error ||
    !post
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
            hitSlop={
              10
            }
            style={({ pressed }) => [
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
            Post
          </Text>

          <View
            style={
              styles.headerButton
            }
          />
        </View>

        <View
          style={
            styles.centered
          }
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={
              32
            }
            color={
              colors.mutedText
            }
          />

          <Text
            style={
              styles.errorTitle
            }
          >
            Post unavailable
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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

  const authorInitial =
    displayName
      .charAt(0)
      .toUpperCase();

  const clubInitial =
    post.club_name
      ?.charAt(0)
      .toUpperCase() ||
    'C';

  const canSubmit =
    commentBody
      .trim()
      .length >
      0 &&
    commentBody
      .trim()
      .length <=
      2000 &&
    !submitting;

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
          style={({ pressed }) => [
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
          Post
        </Text>

        <View
          style={
            styles.headerButton
          }
        />
      </View>

      <KeyboardAvoidingView
        style={
          styles.keyboardView
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
        keyboardVerticalOffset={
          Platform.OS ===
          'ios'
            ? 4
            : 0
        }
      >
        <ScrollView
          ref={
            scrollRef
          }
          style={
            styles.scroll
          }
          contentContainerStyle={
            styles.scrollContent
          }
          onScroll={(
            event
          ) => {
            scrollYRef.current =
              event.nativeEvent
                .contentOffset.y;
          }}
          scrollEventThrottle={
            16
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                refresh
              }
              tintColor={
                colors.gold
              }
            />
          }
        >
          <View
            style={
              styles.postCard
            }
          >
            <View
              style={
                styles.postHeader
              }
            >
              <Pressable
                onPress={() =>
                  openReader(
                    post.author_id
                  )
                }
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
                      styles.postAvatar
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.postAvatarFallback
                    }
                  >
                    <Text
                      style={
                        styles.postAvatarText
                      }
                    >
                      {authorInitial}
                    </Text>
                  </View>
                )}
              </Pressable>

              <View
                style={
                  styles.postAuthorCopy
                }
              >
                <Pressable
                  onPress={() =>
                    openReader(
                      post.author_id
                    )
                  }
                  style={({ pressed }) => [
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={
                      styles.postIdentity
                    }
                  >
                    <Text
                      style={
                        styles.postAuthorName
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {displayName}
                    </Text>

                    {username ? (
                      <Text
                        style={
                          styles.postUsername
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {username}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                {post.club_id &&
                post.club_name ? (
                  <Pressable
                    onPress={() =>
                      openClub(
                        post.club_id!
                      )
                    }
                    style={({ pressed }) => [
                      styles.postAudience,
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
                          styles.clubIcon
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.clubIconFallback
                        }
                      >
                        <Text
                          style={
                            styles.clubIconText
                          }
                        >
                          {clubInitial}
                        </Text>
                      </View>
                    )}

                    <Text
                      style={
                        styles.postAudienceText
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
                          styles.postTime
                        }
                      >
                        ·{' '}
                        {formatRelativeTime(
                          post.created_at
                        )}
                      </Text>
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    style={
                      styles.postAudienceText
                    }
                  >
                    posted to their profile{' '}
                    <Text
                      style={
                        styles.postTime
                      }
                    >
                      ·{' '}
                      {formatRelativeTime(
                        post.created_at
                      )}
                    </Text>
                  </Text>
                )}
              </View>
            </View>

            <Text
              style={
                styles.postBody
              }
            >
              {post.body}
            </Text>

            {post.book_title ? (
              <View
                style={
                  styles.bookCard
                }
              >
                {post.book_cover_url ? (
                  <Image
                    source={{
                      uri:
                        post.book_cover_url,
                    }}
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
                    styles.bookCopy
                  }
                >
                  <Text
                    style={
                      styles.bookTitle
                    }
                  >
                    {post.book_title}
                  </Text>

                  {post.rating ? (
                    <Text
                      style={
                        styles.bookRating
                      }
                    >
                      ★ {post.rating}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View
              style={
                styles.postFooter
              }
            >
              <View
                style={
                  styles.voteControl
                }
              >
                <Pressable
                  disabled={
                    voting
                  }
                  onPress={() =>
                    handleVote(
                      1
                    )
                  }
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
                      21
                    }
                    color={
                      post.viewer_vote ===
                      1
                        ? colors.gold
                        : colors.mutedText
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
                    voting
                  }
                  onPress={() =>
                    handleVote(
                      -1
                    )
                  }
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
                      21
                    }
                    color={
                      post.viewer_vote ===
                      -1
                        ? colors.gold
                        : colors.mutedText
                    }
                  />
                </Pressable>
              </View>

              <View
                style={
                  styles.commentCount
                }
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={
                    15
                  }
                  color={
                    colors.mutedText
                  }
                />

                <Text
                  style={
                    styles.commentCountText
                  }
                >
                  {post.comment_count ??
                    comments.length}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={
              styles.commentsHeader
            }
          >
            <Text
              style={
                styles.commentsTitle
              }
            >
              Comments
            </Text>

            <Text
              style={
                styles.commentsCountLabel
              }
            >
              {comments.length}
            </Text>
          </View>

          <View
            style={
              styles.commentSortRow
            }
          >
            <Pressable
              onPress={() =>
                setCommentSort(
                  'top'
                )
              }
              style={({ pressed }) => [
                styles.commentSortButton,
                commentSort ===
                  'top' &&
                  styles.commentSortButtonActive,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.commentSortText,
                  commentSort ===
                    'top' &&
                    styles.commentSortTextActive,
                ]}
              >
                Top
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setCommentSort(
                  'newest'
                )
              }
              style={({ pressed }) => [
                styles.commentSortButton,
                commentSort ===
                  'newest' &&
                  styles.commentSortButtonActive,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.commentSortText,
                  commentSort ===
                    'newest' &&
                    styles.commentSortTextActive,
                ]}
              >
                Newest
              </Text>
            </Pressable>
          </View>

          {thread.length >
          0 ? (
            <View
              style={
                styles.threadList
              }
            >
              {thread.map(
                (
                  comment
                ) =>
                  renderComment(
                    comment
                  )
              )}
            </View>
          ) : (
            <View
              style={
                styles.emptyComments
              }
            >
              <Ionicons
                name="chatbubbles-outline"
                size={
                  25
                }
                color={
                  colors.mutedText
                }
              />

              <Text
                style={
                  styles.emptyCommentsTitle
                }
              >
                No comments yet
              </Text>

              <Text
                style={
                  styles.emptyCommentsText
                }
              >
                Start the conversation.
              </Text>
            </View>
          )}
        </ScrollView>

        <View
          style={
            styles.composerWrap
          }
        >
          {replyTo ? (
            <View
              style={
                styles.replyingRow
              }
            >
              <Text
                style={
                  styles.replyingText
                }
                numberOfLines={
                  1
                }
              >
                Replying to{' '}
                {replyTo.name}
              </Text>

              <Pressable
                onPress={() =>
                  setReplyTo(
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
                    colors.mutedText
                  }
                />
              </Pressable>
            </View>
          ) : null}

          <View
            style={
              styles.composer
            }
          >
            <TextInput
              value={
                commentBody
              }
              onChangeText={
                setCommentBody
              }
              placeholder={
                replyTo
                  ? `Reply to ${replyTo.name}…`
                  : 'Add a comment…'
              }
              placeholderTextColor={
                colors.mutedText
              }
              multiline
              maxLength={
                2000
              }
              style={
                styles.commentInput
              }
            />

            <Pressable
              disabled={
                !canSubmit
              }
              onPress={
                submitComment
              }
              style={({ pressed }) => [
                styles.sendButton,
                !canSubmit &&
                  styles.sendButtonDisabled,
                pressed &&
                  canSubmit &&
                  styles.pressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.background
                  }
                />
              ) : (
                <Ionicons
                  name="arrow-up"
                  size={
                    19
                  }
                  color={
                    colors.background
                  }
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(
  colors:
    NovoriColors
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
      height: 54,
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
      width: 42,
      height: 42,
      borderRadius:
        21,
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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      width: '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      paddingHorizontal:
        16,
      paddingTop:
        14,
      paddingBottom:
        24,
    },
    centered: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        28,
    },
    errorTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        21,
      marginTop:
        12,
    },
    errorText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        19,
      textAlign:
        'center',
      marginTop:
        7,
    },
    postCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        18,
      padding:
        15,
    },
    postHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
    },
    postAvatar: {
      width:
        44,
      height:
        44,
      borderRadius:
        22,
      backgroundColor:
        colors.elevated,
      marginRight:
        11,
    },
    postAvatarFallback: {
      width:
        44,
      height:
        44,
      borderRadius:
        22,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        11,
    },
    postAvatarText: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        18,
    },
    postAuthorCopy: {
      flex: 1,
      minWidth:
        0,
      paddingTop:
        2,
    },
    postIdentity: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
      minWidth:
        0,
    },
    postAuthorName: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
      flexShrink:
        1,
    },
    postUsername: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      flexShrink:
        1,
    },
    postAudience: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      marginTop:
        4,
      maxWidth:
        '100%',
    },
    postAudienceText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10,
      marginTop:
        4,
      flexShrink:
        1,
    },
    postTime: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10,
    },
    clubIcon: {
      width:
        17,
      height:
        17,
      borderRadius:
        5,
      backgroundColor:
        colors.elevated,
    },
    clubIconFallback: {
      width:
        17,
      height:
        17,
      borderRadius:
        5,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    clubIconText: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        8,
    },
    postBody: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        15,
      lineHeight:
        23,
      marginTop:
        14,
    },
    bookCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        colors.elevated,
      borderRadius:
        13,
      padding:
        10,
      marginTop:
        13,
    },
    bookCover: {
      width:
        42,
      height:
        62,
      borderRadius:
        6,
      backgroundColor:
        colors.surface,
      marginRight:
        10,
    },
    bookCoverFallback: {
      width:
        42,
      height:
        62,
      borderRadius:
        6,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        10,
    },
    bookCopy: {
      flex: 1,
    },
    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      lineHeight:
        18,
    },
    bookRating: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
      marginTop:
        4,
    },
    postFooter: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderTopWidth:
        1,
      borderTopColor:
        colors.border,
      marginTop:
        14,
      paddingTop:
        10,
    },
    voteControl: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        0,
    },
    voteButton: {
      width:
        26,
      height:
        32,
      borderRadius:
        16,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    voteButtonActive: {
      backgroundColor:
        colors.elevated,
    },
    voteScore: {
      minWidth:
        14,
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
      textAlign:
        'center',
    },
    voteScoreActive: {
      color:
        colors.gold,
    },
    commentCount: {
      height:
        32,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
    },
    commentCountText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    commentsHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
      marginTop:
        20,
      marginBottom:
        10,
      paddingHorizontal:
        3,
    },    commentSortRow: {
      height:
        32,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
      marginBottom:
        10,
    },
    commentSortButton: {
      height:
        25,
      minWidth:
        58,
      borderRadius:
        13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
      paddingHorizontal:
        10,
    },
    commentSortButtonActive: {
      backgroundColor:
        colors.elevated,
    },
    commentSortText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10,
    },
    commentSortTextActive: {
      color:
        colors.gold,
    },
    commentsTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        19,
    },
    commentsCountLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    threadList: {
      gap:
        8,
    },
    commentThread: {
      gap:
        7,
    },
    commentCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        15,
      padding:
        12,
    },    commentCardHighlighted: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },
    commentHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },
    commentAvatar: {
      width:
        32,
      height:
        32,
      borderRadius:
        16,
      backgroundColor:
        colors.elevated,
      marginRight:
        9,
    },
    commentAvatarFallback: {
      width:
        32,
      height:
        32,
      borderRadius:
        16,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        9,
    },
    commentAvatarText: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        13,
    },
    commentAuthorCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    commentIdentity: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      minWidth:
        0,
    },
    commentAuthorName: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12,
      flexShrink:
        1,
    },
    commentUsername: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10,
      flexShrink:
        1,
    },
    commentTime: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        9,
      marginTop:
        2,
    },
    commentDelete: {
      width:
        30,
      height:
        30,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginLeft:
        4,
    },
    commentBody: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        19,
      marginTop:
        9,
    },
    commentFooter: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        12,
      marginTop:
        7,
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
        22,
      height:
        24,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    commentVoteButtonActive: {
      backgroundColor:
        colors.elevated,
    },
    commentVoteScore: {
      minWidth:
        14,
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9,
      textAlign:
        'center',
    },
    commentVoteScoreActive: {
      color:
        colors.gold,
    },
    replyButton: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      minHeight:
        24,
    },
    replyButtonText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10,
    },
    emptyComments: {
      minHeight:
        150,
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
      borderRadius:
        16,
      paddingHorizontal:
        24,
    },
    emptyCommentsTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      marginTop:
        8,
    },
    emptyCommentsText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      marginTop:
        3,
    },
    composerWrap: {
      borderTopWidth:
        1,
      borderTopColor:
        colors.border,
      backgroundColor:
        colors.background,
      paddingHorizontal:
        14,
      paddingTop:
        8,
      paddingBottom:
        8,
    },
    replyingRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        4,
      marginBottom:
        6,
    },
    replyingText: {
      flex:
        1,
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10,
      marginRight:
        8,
    },
    composer: {
      minHeight:
        44,
      maxHeight:
        110,
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        16,
      paddingLeft:
        13,
      paddingRight:
        5,
      paddingVertical:
        5,
    },
    commentInput: {
      flex:
        1,
      minHeight:
        32,
      maxHeight:
        96,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        18,
      paddingTop:
        7,
      paddingBottom:
        6,
      paddingRight:
        8,
    },
    sendButton: {
      width:
        34,
      height:
        34,
      borderRadius:
        17,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    sendButtonDisabled: {
      opacity:
        0.35,
    },
    pressed: {
      opacity:
        0.67,
    },
  });
}
