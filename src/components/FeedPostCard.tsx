import { moderationMediaUrl } from '../lib/moderation-media-url';
import {Ionicons} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {useRouter} from 'expo-router';
import {useMemo,useState,type ReactNode} from 'react';
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {useNovoriTheme} from '../context/theme-context';
import {type NovoriColors} from '../constants/novori-theme';
import {type FeedPost,type PostVoteValue,splitQuestionPostBody} from '../lib/feed';
import {containsExplicitLanguage,isExplicitContentRevealed,revealExplicitContentOnce,setExplicitLanguagePreference} from '../lib/content-filter';
import BookCoverImage from './BookCoverImage';
import BookStackPostAttachment from './BookStackPostAttachment';
import CanonicalBookRating from './CanonicalBookRating';
import ClubDiscussionPostAttachment from './ClubDiscussionPostAttachment';
import ClubEventPostAttachment from './ClubEventPostAttachment';
import FeedPostImage from './FeedPostImage';
import PostTypeIdentifier from './PostTypeIdentifier';
import ReadingRecapPostAttachment from './ReadingRecapPostAttachment';
import ValidationWarningSheet from './ValidationWarningSheet';

type Props={post:FeedPost;currentUserId?:string|null;votingPostId?:string|null;deletingPostId?:string|null;allowExplicitLanguage?:boolean;onAlwaysShow?:()=>Promise<void>;onOpen?:(post:FeedPost)=>void;onComments:(post:FeedPost)=>void;onVote:(id:string,vote:PostVoteValue)=>void;onMore?:(post:FeedPost)=>void;onShare:(post:FeedPost)=>void;onReader?:(id:string)=>void;onClub?:(id:string)=>void;renderText?:(content:string,targetType:'post'|'comment',targetId:string,textStyle:any,isOwnContent?:boolean)=>ReactNode};

// The same post markup and styles serve Home and both Profile Activity views.
export default function FeedPostCard({post,currentUserId,votingPostId,deletingPostId,allowExplicitLanguage=false,onAlwaysShow,onOpen,onComments:openCommentsSheet,onVote:handlePostVote,onMore,onShare:shareFeedPost,onReader,onClub,renderText}:Props){
 const {colors}=useNovoriTheme();const router=useRouter();const styles=useMemo(()=>createStyles(colors),[colors]);
 const [revealedExplicitPosts,setRevealedExplicitPosts]=useState<Record<string,boolean>>({});
 const [localExplicit,setLocalExplicit]=useState(false);const [warning,setWarning]=useState('');
 const openReader=(id:string)=>{if(!id)return;if(onReader)onReader(id);else router.push({pathname:'/reader/[id]',params:{id}});};
 const openClub=(id:string)=>{if(onClub)onClub(id);else router.push({pathname:'/club/[id]',params:{id}});};
 async function alwaysShowExplicitLanguage(){try{if(onAlwaysShow)await onAlwaysShow();else await setExplicitLanguagePreference(true);setLocalExplicit(true);}catch{setWarning('Your explicit-language preference could not be saved. Please try again.');}}
function renderDefaultText(
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
              revealedExplicitPosts[
                targetId
              ]
            )
      );

    const shouldHide =
      !isOwnContent &&
      !allowExplicitLanguage && !localExplicit &&
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
          setRevealedExplicitPosts(
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
                colors.gold
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
const renderExplicitContentWarning=renderText??renderDefaultText;

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

    const questionContent =
      post.post_type ===
        'question'
        ? splitQuestionPostBody(
            post.body
          )
        : null;

    return (
      <>
      <Pressable
        key={
          post.id
        }
        onPress={() =>
          (onOpen ?? openCommentsSheet)(post)
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
                    moderationMediaUrl(post.author_avatar_url),
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
                        moderationMediaUrl(post.club_cover_url),
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

          <View
            style={
              styles.feedHeaderActions
            }
          >
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                void shareFeedPost(
                  post
                );
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Share post"
              style={({ pressed }) => [
                styles.feedMoreButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="share-social-outline"
                size={18}
                color={
                  colors.mutedText
                }
              />
            </Pressable>

            {onMore ? (
              <Pressable
                disabled={
                  deletingPostId ===
                  post.id
                }
                onPress={(event) => {
                  event.stopPropagation();

                  onMore?.(post);
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
                      colors.mutedText
                    }
                  />
                ) : (
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={
                      20
                    }
                    color={
                      colors.mutedText
                    }
                  />
                )}
              </Pressable>
            ) : null}
          </View>
        </View>

        <View
          style={
            styles.feedPostContent
          }
        >
          <PostTypeIdentifier
          event={Boolean(post.club_event)}
          discussion={Boolean(post.club_discussion)}
          poll={post.club_discussion?.kind==='poll'}
          announcement={post.is_club_announcement}
            readingRecap={Boolean(post.reading_recap)}
            postType={
              post.post_type
            }
            rating={
              post.rating
            }
            colors={
              colors
            }
          />

          {questionContent ? (
            <>
              {renderExplicitContentWarning(
                questionContent.question,
                'post',
                post.id,
                styles.feedQuestionTitle,
                Boolean(
                  currentUserId &&
                  post.author_id ===
                    currentUserId
                )
              )}

              {questionContent.context ? (
                <View
                  style={
                    styles.feedQuestionContextWrap
                  }
                >
                  {renderExplicitContentWarning(
                    questionContent.context,
                    'post',
                    post.id,
                    styles.feedQuestionContext,
                    Boolean(
                      currentUserId &&
                      post.author_id ===
                        currentUserId
                    )
                  )}
                </View>
              ) : null}
            </>
          ) : post.body.trim() && !post.club_discussion ? (
            renderExplicitContentWarning(
              post.body,
              'post',
              post.id,
              styles.feedBody,
              Boolean(
                currentUserId &&
                post.author_id ===
                  currentUserId
              )
            )
          ) : null}

          {post.club_discussion ? <ClubDiscussionPostAttachment discussion={post.club_discussion}/> : null}
          {post.club_event ? <ClubEventPostAttachment event={post.club_event} /> : null}
        {post.reading_recap ? <ReadingRecapPostAttachment snapshot={post.reading_recap} /> : null}

          {post.post_type ===
            'book_stack' &&
          post.book_stack_id ? (
            <View>
              <BookStackPostAttachment
                stackId={
                  post.book_stack_id
                }
                compactTopSpacing={
                  !post.body.trim()
                }
              />
            </View>
          ) : null}

          {post.post_image_url ? (
            <FeedPostImage
              uri={
                post.post_image_url
              }
              colors={
                colors
              }
            />
          ) : null}

          {post.book_title ? (
            post.post_image_url ? (
              <Pressable
                disabled={
                  !post.google_book_id
                }
                onPress={(event) => {
                  event.stopPropagation();

                  if (
                    !post.google_book_id
                  ) {
                    return;
                  }

                  router.push({
                    pathname:
                      '/book/[id]',
                    params: {
                      id:
                        post.google_book_id,
                      source:
                        'feed',
                    },
                  });
                }}
                style={({
                  pressed,
                }) => [
                  styles.feedCompactBookLink,
                  pressed &&
                    Boolean(
                      post.google_book_id
                    ) &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="book-outline"
                  size={
                    14
                  }
                  color={
                    colors.gold
                  }
                />

                <View
                  style={
                    styles.feedCompactBookCopy
                  }
                >
                  <Text
                    style={
                      styles.feedCompactBookTitle
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {post.book_title}
                  </Text>

                  {(post.book_authors &&
                    post.book_authors.length >
                      0) ||
                  post.book_series_name ? (
                    <Text
                      style={
                        styles.feedCompactBookMeta
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {post.book_authors &&
                      post.book_authors.length >
                        0
                        ? post.book_authors.join(
                            ', '
                          )
                        : ''}
                      {post.book_authors &&
                      post.book_authors.length >
                        0 &&
                      post.book_series_name
                        ? ' · '
                        : ''}
                      {post.book_series_name
                        ? `${post.book_series_name}${post.book_series_position !== null
                            ? ` #${post.book_series_position}`
                            : ''}`
                        : ''}
                    </Text>
                  ) : null}

                  {(post.post_type ===
                    'question' ||
                    post.post_type ===
                      'reading_update') &&
                  post.book_title ? (
                    <CanonicalBookRating
                      googleBookId={
                        post.google_book_id
                      }
                      title={
                        post.book_title
                      }
                      authors={
                        post.book_authors
                      }
                      compact
                    />
                  ) : null}
                </View>

                {post.google_book_id ? (
                  <Ionicons
                    name="chevron-forward"
                    size={
                      15
                    }
                    color={
                      colors.mutedText
                    }
                  />
                ) : null}
              </Pressable>
            ) : (
              <Pressable
                disabled={
                  !post.google_book_id
                }
                onPress={(event) => {
                  event.stopPropagation();

                  if (
                    !post.google_book_id
                  ) {
                    return;
                  }

                  router.push({
                    pathname:
                      '/book/[id]',
                    params: {
                      id:
                        post.google_book_id,
                      source:
                        'feed',
                    },
                  });
                }}
                style={({
                  pressed,
                }) => [
                  styles.feedBookCard,
                  pressed &&
                    Boolean(
                      post.google_book_id
                    ) &&
                    styles.pressed,
                ]}
              >
                {(post.google_book_id || post.book_cover_url) ? (
                  <BookCoverImage
                    googleBookId={post.google_book_id}
                    existingCoverUrl={post.book_cover_url}
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
                        colors.gold
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
                        colors.gold
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
                    {post.book_title}
                  </Text>

                  {post.book_authors &&
                  post.book_authors.length >
                    0 ? (
                    <Text
                      style={
                        styles.feedBookAuthor
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {post.book_authors.join(
                        ', '
                      )}
                    </Text>
                  ) : null}

                  {(post.post_type ===
                    'question' ||
                    post.post_type ===
                      'reading_update') &&
                  post.book_title ? (
                    <CanonicalBookRating
                      googleBookId={
                        post.google_book_id
                      }
                      title={
                        post.book_title
                      }
                      authors={
                        post.book_authors
                      }
                    />
                  ) : null}

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
                          colors.gold
                        }
                      />

                      <Text
                        style={
                          styles.feedBookRating
                        }
                      >
                        {post.rating}
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
                      colors.mutedText
                    }
                  />
                ) : null}
              </Pressable>
            )
          ) : null}
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
                    ? colors.gold
                    : colors.mutedText
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
                colors.mutedText
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
      <ValidationWarningSheet visible={!!warning} title="Could not save preference" message={warning} onDismiss={()=>setWarning('')}/>
      </>
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
function createStyles(colors:NovoriColors){return StyleSheet.create({feedPostCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
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
feedHeaderActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginLeft:
        4,
      marginTop:
        -2,
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
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
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
        12,
    },
feedAvatarText: {
      color:
        colors.text,
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
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13.5,
      flexShrink:
        0,
    },
feedUsername: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      flex:
        1,
      flexShrink:
        1,
      minWidth:
        0,
    },
feedTime: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
    },
feedAudienceText: {
      color:
        colors.mutedText,
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
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
feedClubIconFallback: {
      width:
        18,
      height:
        18,
      borderRadius:
        6,
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
    },
feedClubIconText: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        8,
    },
feedClubText: {
      color:
        colors.softGold,
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
feedBody: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        15,
      lineHeight:
        22,
    },
feedQuestionTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize:
        19,
      lineHeight:
        26,
    },
feedQuestionContextWrap: {
      marginTop:
        8,
    },
feedQuestionContext: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      lineHeight:
        21,
    },
feedCompactBookLink: {
      minHeight:
        42,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        8,
      marginTop:
        7,
      paddingHorizontal:
        2,
      paddingVertical:
        7,
    },
feedCompactBookCopy: {
      flex:
        1,
      minWidth:
        0,
    },
feedCompactBookTitle: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
feedCompactBookMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      fontStyle:
        'italic',
      marginTop:
        2,
    },
feedBookCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
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
        colors.surface,
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
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
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
        colors.gold,
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
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      lineHeight:
        18,
    },
feedBookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        4,
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
        colors.gold,
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
        colors.border,
    },
voteControl: {
      flexDirection:
        'row',
      alignItems:
        'center',
      minHeight:
        36,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
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
        colors.surface,
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
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
voteScoreActive: {
      color:
        colors.gold,
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
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        18,
      paddingHorizontal:
        12,
    },
commentActionText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
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
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
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
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
      lineHeight:
        19,
    },
explicitWarningText: {
      color:
        colors.secondaryText,
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
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
explicitWarningButtonPrimary: {
      backgroundColor:
        colors.gold,
      borderColor:
        colors.gold,
    },
explicitWarningButtonText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
explicitWarningButtonPrimaryText: {
      color:
        colors.background,
    },
pressed: {
      opacity: 0.68,
    }});}
