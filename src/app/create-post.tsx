import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import BookCoverImage from '../components/BookCoverImage';
import PhotoSourceSheet from '../components/PhotoSourceSheet';
import PostPhotoCropper, { PostCropAsset } from '../components/PostPhotoCropper';
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
  getPostDetail,
  PostImageUpload,
  updatePost,
  uploadPostImage,
} from '../lib/feed';
import {
  getNovoriSearchBookCover,
  getNovoriSearchBookIsbn,
  GoogleBookSearchItem,
  resolveNovoriSearchBookCover,
  searchNovoriBooks,
} from '../lib/book-search';
import {
  supabase,
} from '../lib/supabase';

type ViewerProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Destination =
  | {
      type: 'profile';
      clubId: null;
    }
  | {
      type: 'club';
      clubId: string;
    };

type AttachedBook = {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  seriesName: string | null;
  seriesPosition: number | null;
};

type HardcoverSeriesResponse = {
  series: {
    name: string;
    currentPosition?: number | null;
  } | null;
  error?: string;
};

async function getSeriesMetadata(
  item: GoogleBookSearchItem
) {
  const isbn =
    getNovoriSearchBookIsbn(
      item
    );

  if (!isbn) {
    return {
      name: null,
      position: null,
    };
  }

  try {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'hardcover-series',
        {
          body: {
            isbn,
          },
        }
      );

    if (error) {
      console.warn(
        'Could not load series metadata:',
        error
      );

      return {
        name: null,
        position: null,
      };
    }

    const response =
      data as
        HardcoverSeriesResponse;

    return {
      name:
        response.series
          ?.name ??
        null,
      position:
        response.series
          ?.currentPosition ??
        null,
    };
  } catch (
    error
  ) {
    console.warn(
      'Could not load series metadata:',
      error
    );

    return {
      name: null,
      position: null,
    };
  }
}

export default function CreatePostScreen() {
  const router =
    useRouter();
  const insets =
    useSafeAreaInsets();

  const params =
    useLocalSearchParams<{
      clubId?: string;
      editPostId?: string;
    }>();

  const requestedClubId =
    typeof params.clubId ===
    'string'
      ? params.clubId
      : '';

  const editPostId =
    typeof params.editPostId ===
    'string'
      ? params.editPostId
      : '';

  const isEditing =
    Boolean(
      editPostId
    );

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

  const [
    body,
    setBody,
  ] =
    useState('');

  const [
    clubs,
    setClubs,
  ] =
    useState<
      ClubWithMembership[]
    >([]);

  const [
    loadingClubs,
    setLoadingClubs,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    loadingEditPost,
    setLoadingEditPost,
  ] =
    useState(
      Boolean(
        editPostId
      )
    );

  const [
    viewerProfile,
    setViewerProfile,
  ] =
    useState<ViewerProfile | null>(
      null
    );

  const [
    destinationExpanded,
    setDestinationExpanded,
  ] =
    useState(false);

  const [
    destination,
    setDestination,
  ] =
    useState<Destination>({
      type:
        'profile',
      clubId:
        null,
    });

  const [
    photoSourceVisible,
    setPhotoSourceVisible,
  ] =
    useState(false);

  const [
    cropAsset,
    setCropAsset,
  ] =
    useState<PostCropAsset | null>(
      null
    );

  const [
    cropVisible,
    setCropVisible,
  ] =
    useState(false);

  const [
    pendingPhoto,
    setPendingPhoto,
  ] =
    useState<PostImageUpload | null>(
      null
    );

  const [
    existingImageUrl,
    setExistingImageUrl,
  ] =
    useState<string | null>(
      null
    );

  const [
    removeExistingImage,
    setRemoveExistingImage,
  ] =
    useState(false);

  const [
    attachedBook,
    setAttachedBook,
  ] =
    useState<AttachedBook | null>(
      null
    );

  const [
    bookPickerVisible,
    setBookPickerVisible,
  ] =
    useState(false);

  const [
    bookQuery,
    setBookQuery,
  ] =
    useState('');

  const [
    bookResults,
    setBookResults,
  ] =
    useState<
      GoogleBookSearchItem[]
    >([]);

  const [
    bookSearching,
    setBookSearching,
  ] =
    useState(false);

  const [
    bookSearchError,
    setBookSearchError,
  ] =
    useState('');

  useEffect(() => {
    let active =
      true;

    async function load() {
      try {
        const [
          myClubs,
          editingPost,
          authResult,
        ] =
          await Promise.all([
            getMyClubs(),
            editPostId
              ? getPostDetail(
                  editPostId
                )
              : Promise.resolve(
                  null
                ),
            supabase.auth.getUser(),
          ]);

        if (
          !active
        ) {
          return;
        }

        setClubs(
          myClubs
        );

        const user =
          authResult.data.user;

        if (
          user
        ) {
          const {
            data:
              profileData,
            error:
              profileError,
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
            !profileError &&
            active
          ) {
            setViewerProfile(
              profileData
            );
          }
        }

        if (
          editingPost
        ) {
          if (
            authResult.error ||
            !user ||
            editingPost.author_id !==
              user.id
          ) {
            Alert.alert(
              'Cannot edit post',
              'You can only edit your own posts.',
              [
                {
                  text:
                    'OK',
                  onPress: () =>
                    router.back(),
                },
              ]
            );
            return;
          }

          setBody(
            editingPost.body
          );

          setExistingImageUrl(
            editingPost.post_image_url ??
            null
          );

          if (
            editingPost.book_title
          ) {
            setAttachedBook({
              id:
                editingPost.google_book_id ??
                '',
              title:
                editingPost.book_title,
              authors:
                editingPost.book_authors ??
                [],
              coverUrl:
                editingPost.book_cover_url,
              seriesName:
                editingPost.book_series_name ??
                null,
              seriesPosition:
                editingPost.book_series_position ??
                null,
            });
          }

          if (
            editingPost.club_id
          ) {
            setDestination({
              type:
                'club',
              clubId:
                editingPost.club_id,
            });
          } else {
            setDestination({
              type:
                'profile',
              clubId:
                null,
            });
          }
        } else if (
          requestedClubId &&
          myClubs.some(
            (club) =>
              club.id ===
              requestedClubId
          )
        ) {
          setDestination({
            type:
              'club',
            clubId:
              requestedClubId,
          });
        }
      } catch (
        error
      ) {
        console.error(
          isEditing
            ? 'Could not load post for editing:'
            : 'Could not load post destinations:',
          error
        );

        if (
          active &&
          isEditing
        ) {
          Alert.alert(
            'Could not load post',
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
        }
      } finally {
        if (
          active
        ) {
          setLoadingClubs(
            false
          );
          setLoadingEditPost(
            false
          );
        }
      }
    }

    void load();

    return () => {
      active =
        false;
    };
  }, [
    editPostId,
    isEditing,
    requestedClubId,
    router,
  ]);

  useEffect(() => {
    const query =
      bookQuery.trim();

    if (
      !bookPickerVisible ||
      query.length <
        2
    ) {
      setBookResults(
        []
      );
      setBookSearchError(
        ''
      );
      setBookSearching(
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
            setBookSearching(
              true
            );
            setBookSearchError(
              ''
            );

            const results =
              await searchNovoriBooks(
                query
              );

            if (
              active
            ) {
              setBookResults(
                results
              );
            }
          } catch (
            error
          ) {
            if (
              active
            ) {
              setBookResults(
                []
              );
              setBookSearchError(
                'Could not search books. Please try again.'
              );
            }
          } finally {
            if (
              active
            ) {
              setBookSearching(
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
    bookPickerVisible,
    bookQuery,
  ]);

  const trimmedBody =
    body.trim();

  const canPost =
    trimmedBody.length >
      0 &&
    trimmedBody.length <=
      4000 &&
    !saving &&
    !loadingEditPost;

  const profileSelected =
    destination.type ===
    'profile';

  const profileName =
    viewerProfile?.display_name?.trim() ||
    viewerProfile?.username?.trim() ||
    'My Profile';

  const profileInitial =
    profileName
      .charAt(0)
      .toUpperCase() ||
    'N';

  const selectedClub =
    destination.type ===
      'club'
      ? clubs.find(
          (club) =>
            club.id ===
            destination.clubId
        ) ??
        null
      : null;

  const selectedTitle =
    profileSelected
      ? 'My Profile'
      : selectedClub
          ?.name ??
        'Choose destination';

  const selectedSubtitle =
    profileSelected
      ? 'Your followers'
      : 'Club';

  const visibleImageUrl =
    pendingPhoto
      ?.uri ??
    (
      !removeExistingImage
        ? existingImageUrl
        : null
    );

  async function choosePhotoFromLibrary() {
    try {
      const result =
        await ImagePicker
          .launchImageLibraryAsync({
            mediaTypes:
              ['images'],
            allowsEditing:
              false,
            quality:
              1,
          });

      if (
        result.canceled ||
        !result.assets[0]
      ) {
        return;
      }

      const asset =
        result.assets[0];

      if (
        !asset.width ||
        !asset.height
      ) {
        throw new Error(
          'Novori could not read the dimensions of this photo.'
        );
      }

      setCropAsset({
        uri:
          asset.uri,
        width:
          asset.width,
        height:
          asset.height,
      });
      setCropVisible(
        true
      );
    } catch (
      error
    ) {
      Alert.alert(
        'Could not choose photo',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    }
  }

  async function takePhoto() {
    try {
      const permission =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'Camera access needed',
          'Allow Novori to use your camera so you can take a photo.'
        );
        return;
      }

      const result =
        await ImagePicker
          .launchCameraAsync({
            mediaTypes:
              ['images'],
            allowsEditing:
              false,
            quality:
              1,
          });

      if (
        result.canceled ||
        !result.assets[0]
      ) {
        return;
      }

      const asset =
        result.assets[0];

      if (
        !asset.width ||
        !asset.height
      ) {
        throw new Error(
          'Novori could not read the dimensions of this photo.'
        );
      }

      setCropAsset({
        uri:
          asset.uri,
        width:
          asset.width,
        height:
          asset.height,
      });
      setCropVisible(
        true
      );
    } catch (
      error
    ) {
      Alert.alert(
        'Could not take photo',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    }
  }

  function cancelPhotoCrop() {
    setCropVisible(
      false
    );
    setCropAsset(
      null
    );
  }

  function useCroppedPhoto(
    uri: string
  ) {
    setPendingPhoto({
      uri,
      fileName:
        'post-photo.jpg',
      mimeType:
        'image/jpeg',
    });
    setRemoveExistingImage(
      false
    );
    setCropVisible(
      false
    );
    setCropAsset(
      null
    );
  }

  function removePhoto() {
    setPendingPhoto(
      null
    );
    if (
      existingImageUrl
    ) {
      setRemoveExistingImage(
        true
      );
    }
  }

  async function selectBook(
    item:
      GoogleBookSearchItem
  ) {
    const baseBook = {
      id:
        item.id,
      title:
        item.volumeInfo
          .title ??
        'Untitled',
      authors:
        item.volumeInfo
          .authors ??
        [],
      coverUrl:
        getNovoriSearchBookCover(
          item
        ),
      seriesName:
        null as
          | string
          | null,
      seriesPosition:
        null as
          | number
          | null,
    };

    setAttachedBook(
      baseBook
    );

    setBookPickerVisible(
      false
    );
    setBookQuery(
      ''
    );
    setBookResults(
      []
    );

    const [
      series,
      resolvedCover,
    ] =
      await Promise.all([
        getSeriesMetadata(
          item
        ),
        resolveNovoriSearchBookCover(
          item
        ).catch(
          (
            error
          ) => {
            console.warn(
              'Could not refine Post book cover:',
              error
            );
            return null;
          }
        ),
      ]);

    setAttachedBook(
      (current) =>
        current?.id ===
        item.id
          ? {
              ...current,
              coverUrl:
                resolvedCover ??
                current.coverUrl,
              seriesName:
                series.name,
              seriesPosition:
                series.position,
            }
          : current
    );
  }

  async function handlePost() {
    if (
      !canPost
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      const clubId =
        destination.type ===
          'club'
          ? destination.clubId
          : null;

      let imageUrl =
        removeExistingImage
          ? null
          : existingImageUrl;

      if (
        pendingPhoto
      ) {
        imageUrl =
          await uploadPostImage(
            pendingPhoto
          );
      }

      const postPayload = {
        body:
          trimmedBody,
        clubId,
        googleBookId:
          attachedBook?.id ||
          null,
        bookTitle:
          attachedBook?.title ??
          null,
        bookCoverUrl:
          attachedBook?.coverUrl ??
          null,
        bookAuthors:
          attachedBook?.authors ??
          null,
        bookSeriesName:
          attachedBook?.seriesName ??
          null,
        bookSeriesPosition:
          attachedBook?.seriesPosition ??
          null,
        imageUrl,
      };

      if (
        isEditing
      ) {
        await updatePost(
          editPostId,
          postPayload
        );
      } else {
        await createPost(
          postPayload
        );
      }

      if (
        isEditing
      ) {
        router.replace(
          '/(tabs)'
        );
      } else if (
        destination.type ===
          'club' &&
        requestedClubId
      ) {
        router.replace({
          pathname:
            '/club/[id]',
          params: {
            id:
              destination.clubId,
          },
        });
      } else {
        router.replace(
          '/(tabs)'
        );
      }
    } catch (
      error
    ) {
      console.error(
        isEditing
          ? 'Could not update post:'
          : 'Could not create post:',
        error
      );

      Alert.alert(
        isEditing
          ? 'Could not save changes'
          : 'Could not post',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  if (
    loadingEditPost
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.loadingState
          }
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

  return (
    <>
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
                name="close"
                size={
                  25
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
              {isEditing
                ? 'Edit Post'
                : 'Create Post'}
            </Text>

            <Pressable
              disabled={
                !canPost
              }
              onPress={
                handlePost
              }
              style={({
                pressed,
              }) => [
                styles.headerPostButton,
                !canPost &&
                  styles.headerPostButtonDisabled,
                pressed &&
                  canPost &&
                  styles.pressed,
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
                    styles.headerPostButtonText
                  }
                >
                  {isEditing
                    ? 'Save'
                    : 'Post'}
                </Text>
              )}
            </Pressable>
          </View>

          <KeyboardAwareScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS ===
              'ios'
                ? 'interactive'
                : 'on-drag'
            }
            bottomOffset={
              20
            }
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.content
            }
          >
            <Pressable
              onPress={() =>
                setDestinationExpanded(
                  (
                    current
                  ) =>
                    !current
                )
              }
              style={({
                pressed,
              }) => [
                styles.destinationBar,
                destinationExpanded &&
                  styles.destinationBarOpen,
                pressed &&
                  styles.pressed,
              ]}
            >
              {profileSelected ? null : selectedClub
                  ?.cover_url ? (
                <Image
                  source={{
                    uri:
                      selectedClub.cover_url,
                  }}
                  style={[
                    styles.destinationAvatar,
                    styles.clubDestinationAvatar,
                  ]}
                />
              ) : (
                <View
                  style={
                    styles.clubAvatarFallback
                  }
                >
                  <Text
                    style={
                      styles.clubAvatarText
                    }
                  >
                    {selectedClub
                      ?.name
                      .charAt(
                        0
                      )
                      .toUpperCase() ??
                      'C'}
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
                    styles.destinationEyebrow
                  }
                >
                  POST TO
                </Text>

                <Text
                  style={
                    styles.destinationTitle
                  }
                  numberOfLines={
                    1
                  }
                >
                  {selectedTitle}
                </Text>

                <Text
                  style={
                    styles.destinationSubtitle
                  }
                  numberOfLines={
                    1
                  }
                >
                  {selectedSubtitle}
                </Text>
              </View>

              {loadingClubs ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.gold
                  }
                />
              ) : (
                <View
                  style={
                    styles.destinationChevron
                  }
                >
                  <Ionicons
                    name={
                      destinationExpanded
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={
                      18
                    }
                    color={
                      colors.gold
                    }
                  />
                </View>
              )}
            </Pressable>

            {destinationExpanded ? (
              <View
                style={
                  styles.destinationDropdown
                }
              >
                <Pressable
                  onPress={() => {
                    setDestination({
                      type:
                        'profile',
                      clubId:
                        null,
                    });
                    setDestinationExpanded(
                      false
                    );
                  }}
                  style={({
                    pressed,
                  }) => [
                    styles.dropdownRow,
                    profileSelected &&
                      styles.dropdownRowSelected,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {viewerProfile
                    ?.avatar_url ? (
                    <Image
                      source={{
                        uri:
                          viewerProfile.avatar_url,
                      }}
                      style={
                        styles.dropdownAvatar
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.dropdownAvatarFallback
                      }
                    >
                      <Text
                        style={
                          styles.profileAvatarInitial
                        }
                      >
                        {profileInitial}
                      </Text>
                    </View>
                  )}

                  <View
                    style={
                      styles.dropdownCopy
                    }
                  >
                    <Text
                      style={[
                        styles.dropdownTitle,
                        profileSelected &&
                          styles.dropdownTitleSelected,
                      ]}
                    >
                      My Profile
                    </Text>
                    <Text
                      style={
                        styles.dropdownSubtitle
                      }
                    >
                      Your followers
                    </Text>
                  </View>

                  {profileSelected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={
                        20
                      }
                      color={
                        colors.gold
                      }
                    />
                  ) : null}
                </Pressable>

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
                          setDestinationExpanded(
                            false
                          );
                        }}
                        style={({
                          pressed,
                        }) => [
                          styles.dropdownRow,
                          selected &&
                            styles.dropdownRowSelected,
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
                            style={[
                              styles.dropdownAvatar,
                              styles.clubDestinationAvatar,
                            ]}
                          />
                        ) : (
                          <View
                            style={
                              styles.dropdownClubFallback
                            }
                          >
                            <Text
                              style={
                                styles.clubAvatarText
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

                        <View
                          style={
                            styles.dropdownCopy
                          }
                        >
                          <Text
                            style={[
                              styles.dropdownTitle,
                              selected &&
                                styles.dropdownTitleSelected,
                            ]}
                            numberOfLines={
                              1
                            }
                          >
                            {club.name}
                          </Text>

                          <Text
                            style={
                              styles.dropdownSubtitle
                            }
                          >
                            Club
                          </Text>
                        </View>

                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={
                              20
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

            <View
              style={
                styles.feedPreviewCard
              }
            >
              <View
                style={
                  styles.feedPreviewHeader
                }
              >
                {viewerProfile
                  ?.avatar_url ? (
                  <Image
                    source={{
                      uri:
                        viewerProfile.avatar_url,
                    }}
                    style={
                      styles.feedPreviewAvatar
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.feedPreviewAvatarFallback
                    }
                  >
                    <Text
                      style={
                        styles.feedPreviewAvatarText
                      }
                    >
                      {profileInitial}
                    </Text>
                  </View>
                )}

                <View
                  style={
                    styles.feedPreviewAuthorCopy
                  }
                >
                  <View
                    style={
                      styles.feedPreviewIdentity
                    }
                  >
                    <Text
                      style={
                        styles.feedPreviewAuthorName
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {profileName}
                    </Text>

                    {viewerProfile
                      ?.username
                      ?.trim() ? (
                      <Text
                        style={
                          styles.feedPreviewUsername
                        }
                        numberOfLines={
                          1
                        }
                      >
                        @{viewerProfile.username.trim()}
                      </Text>
                    ) : null}
                  </View>

                  {destination.type ===
                    'club' &&
                  selectedClub ? (
                    <Text
                      style={
                        styles.feedPreviewAudienceText
                      }
                      numberOfLines={
                        1
                      }
                    >
                      in {selectedClub.name}{' '}
                      <Text
                        style={
                          styles.feedPreviewTime
                        }
                      >
                        · now
                      </Text>
                    </Text>
                  ) : (
                    <Text
                      style={
                        styles.feedPreviewAudienceText
                      }
                    >
                      posted to their profile{' '}
                      <Text
                        style={
                          styles.feedPreviewTime
                        }
                      >
                        · now
                      </Text>
                    </Text>
                  )}
                </View>

                <Ionicons
                  name="ellipsis-horizontal"
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
                  styles.feedPreviewContent
                }
              >
                <TextInput
                  value={
                    body
                  }
                  onChangeText={
                    setBody
                  }
                  placeholder="Share something with readers..."
                  placeholderTextColor={
                    colors.mutedText
                  }
                  multiline
                  maxLength={
                    4000
                  }
                  textAlignVertical="top"
                  autoFocus={
                    !isEditing
                  }
                  style={
                    styles.feedPreviewBodyInput
                  }
                />

                {visibleImageUrl ? (
                  <View
                    style={
                      styles.feedPreviewPhotoWrap
                    }
                  >
                    <Image
                      source={{
                        uri:
                          visibleImageUrl,
                      }}
                      style={
                        styles.feedPreviewPhoto
                      }
                      resizeMode="cover"
                    />
                  </View>
                ) : null}

                {attachedBook ? (
                  visibleImageUrl ? (
                    <Pressable
                      disabled={
                        !attachedBook.id
                      }
                      onPress={() => {
                        if (
                          !attachedBook.id
                        ) {
                          return;
                        }

                        router.push({
                          pathname:
                            '/book/[id]',
                          params: {
                            id:
                              attachedBook.id,
                          },
                        });
                      }}
                      style={({
                        pressed,
                      }) => [
                        styles.feedPreviewCompactBook,
                        pressed &&
                          Boolean(
                            attachedBook.id
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
                          styles.feedPreviewCompactBookCopy
                        }
                      >
                        <Text
                          style={
                            styles.feedPreviewCompactBookTitle
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {attachedBook.title}
                        </Text>

                        {attachedBook
                          .authors.length >
                          0 ||
                        attachedBook
                          .seriesName ? (
                          <Text
                            style={
                              styles.feedPreviewCompactBookMeta
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {attachedBook
                              .authors.length >
                            0
                              ? attachedBook.authors.join(
                                  ', '
                                )
                              : ''}
                            {attachedBook
                              .authors.length >
                              0 &&
                            attachedBook
                              .seriesName
                              ? ' · '
                              : ''}
                            {attachedBook
                              .seriesName
                              ? `${attachedBook.seriesName}${attachedBook.seriesPosition !== null
                                  ? ` #${attachedBook.seriesPosition}`
                                  : ''}`
                              : ''}
                          </Text>
                        ) : null}
                      </View>

                      {attachedBook.id ? (
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
                        !attachedBook.id
                      }
                      onPress={() => {
                        if (
                          !attachedBook.id
                        ) {
                          return;
                        }

                        router.push({
                          pathname:
                            '/book/[id]',
                          params: {
                            id:
                              attachedBook.id,
                          },
                        });
                      }}
                      style={({
                        pressed,
                      }) => [
                        styles.feedPreviewBookCard,
                        pressed &&
                          Boolean(
                            attachedBook.id
                          ) &&
                          styles.pressed,
                      ]}
                    >
                      {attachedBook
                        .coverUrl ? (
                        <Image
                          source={{
                            uri:
                              attachedBook.coverUrl,
                          }}
                          style={
                            styles.feedPreviewBookCover
                          }
                        />
                      ) : (
                        <View
                          style={
                            styles.feedPreviewBookCoverFallback
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
                          styles.feedPreviewBookCopy
                        }
                      >
                        <View
                          style={
                            styles.feedPreviewBookEyebrow
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
                              styles.feedPreviewBookEyebrowText
                            }
                          >
                            Book
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.feedPreviewBookTitle
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {attachedBook.title}
                        </Text>

                        {attachedBook
                          .authors.length >
                        0 ? (
                          <Text
                            style={
                              styles.feedPreviewBookAuthor
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {attachedBook.authors.join(
                              ', '
                            )}
                          </Text>
                        ) : null}
                      </View>

                      {attachedBook.id ? (
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

            </View>

            <View
              style={
                styles.previewAttachmentManagement
              }
            >
              <Text
                style={
                  styles.previewAttachmentManagementText
                }
              >
                {body.length}/4000
              </Text>

              {visibleImageUrl ? (
                <Pressable
                  onPress={
                    removePhoto
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.previewManageButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.previewManageButtonText
                    }
                  >
                    Remove photo
                  </Text>
                </Pressable>
              ) : null}

              {attachedBook ? (
                <Pressable
                  onPress={() =>
                    setAttachedBook(
                      null
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.previewManageButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.previewManageButtonText
                    }
                  >
                    Remove book
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View
              style={
                styles.attachmentToolbar
              }
            >
              <Text
                style={
                  styles.attachmentToolbarTitle
                }
              >
                Add to your post
              </Text>

              <View
                style={
                  styles.attachmentActions
                }
              >
                <Pressable
                  onPress={() =>
                    setPhotoSourceVisible(
                      true
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.attachmentAction,
                    visibleImageUrl &&
                      styles.attachmentActionActive,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={
                      styles.attachmentIcon
                    }
                  >
                    <Ionicons
                      name={
                        visibleImageUrl
                          ? 'image'
                          : 'image-outline'
                      }
                      size={
                        20
                      }
                      color={
                        colors.gold
                      }
                    />
                  </View>
                  <Text
                    style={
                      styles.attachmentActionText
                    }
                  >
                    {visibleImageUrl
                      ? 'Replace photo'
                      : 'Photo'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setBookPickerVisible(
                      true
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.attachmentAction,
                    attachedBook &&
                      styles.attachmentActionActive,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={
                      styles.attachmentIcon
                    }
                  >
                    <Ionicons
                      name={
                        attachedBook
                          ? 'book'
                          : 'book-outline'
                      }
                      size={
                        20
                      }
                      color={
                        colors.gold
                      }
                    />
                  </View>
                  <Text
                    style={
                      styles.attachmentActionText
                    }
                  >
                    {attachedBook
                      ? 'Change book'
                      : 'Book'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View
              style={
                styles.footerNote
              }
            >
              <Ionicons
                name="people-outline"
                size={
                  16
                }
                color={
                  colors.mutedText
                }
              />
              <Text
                style={
                  styles.footerNoteText
                }
              >
                {profileSelected
                  ? 'This will appear to readers who follow you.'
                  : `This will be shared with ${selectedClub?.name ?? 'this club'}.`}
              </Text>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </SafeAreaView>

      <PhotoSourceSheet
        visible={
          photoSourceVisible
        }
        title={
          visibleImageUrl
            ? 'Replace Photo'
            : 'Add Photo'
        }
        subtitle="Choose a photo for this post."
        colors={
          colors
        }
        onClose={() =>
          setPhotoSourceVisible(
            false
          )
        }
        onTakePhoto={async () => {
          setPhotoSourceVisible(
            false
          );
          await takePhoto();
        }}
        onChooseLibrary={async () => {
          setPhotoSourceVisible(
            false
          );
          await choosePhotoFromLibrary();
        }}
      />

      <PostPhotoCropper
        visible={
          cropVisible
        }
        asset={
          cropAsset
        }
        colors={
          colors
        }
        title="Position Photo"
        onCancel={
          cancelPhotoCrop
        }
        onUse={
          useCroppedPhoto
        }
      />

      <Modal
        visible={
          bookPickerVisible
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setBookPickerVisible(
            false
          )
        }
      >
        <SafeAreaView
          style={
            styles.bookPickerSafeArea
          }
          edges={[
            'top',
            'bottom',
          ]}
        >
          <View
            style={
              styles.bookPickerHeader
            }
          >
            <Pressable
              onPress={() =>
                setBookPickerVisible(
                  false
                )
              }
              hitSlop={
                10
              }
              style={
                styles.bookPickerHeaderButton
              }
            >
              <Ionicons
                name="close"
                size={
                  24
                }
                color={
                  colors.text
                }
              />
            </Pressable>

            <View
              style={
                styles.bookPickerHeaderCopy
              }
            >
              <Text
                style={
                  styles.bookPickerTitle
                }
              >
                Attach a Book
              </Text>
              <Text
                style={
                  styles.bookPickerSubtitle
                }
              >
                Give readers context without turning this into a review.
              </Text>
            </View>
          </View>

          <View
            style={
              styles.bookSearchBar
            }
          >
            <Ionicons
              name="search"
              size={
                19
              }
              color={
                colors.mutedText
              }
            />
            <TextInput
              value={
                bookQuery
              }
              onChangeText={
                setBookQuery
              }
              placeholder="Search title or author"
              placeholderTextColor={
                colors.mutedText
              }
              autoFocus
              style={
                styles.bookSearchInput
              }
            />
            {bookSearching ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.gold
                }
              />
            ) : null}
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.bookResultsContent,
              {
                paddingBottom:
                  Math.max(
                    insets.bottom,
                    16
                  ) +
                  24,
              },
            ]}
            showsVerticalScrollIndicator={
              false
            }
          >
            {bookSearchError ? (
              <View
                style={
                  styles.bookSearchState
                }
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={
                    26
                  }
                  color={
                    colors.mutedText
                  }
                />
                <Text
                  style={
                    styles.bookSearchStateText
                  }
                >
                  {bookSearchError}
                </Text>
              </View>
            ) : bookQuery
                .trim()
                .length <
              2 ? (
              <View
                style={
                  styles.bookSearchState
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
                <Text
                  style={
                    styles.bookSearchStateTitle
                  }
                >
                  Find the book you’re talking about
                </Text>
                <Text
                  style={
                    styles.bookSearchStateText
                  }
                >
                  Search by title or author, then tap a result to attach it.
                </Text>
              </View>
            ) : !bookSearching &&
              bookResults.length ===
                0 ? (
              <View
                style={
                  styles.bookSearchState
                }
              >
                <Text
                  style={
                    styles.bookSearchStateTitle
                  }
                >
                  No books found
                </Text>
                <Text
                  style={
                    styles.bookSearchStateText
                  }
                >
                  Try a different title or author.
                </Text>
              </View>
            ) : (
              bookResults.map(
                (
                  item
                ) => {
                  const info =
                    item.volumeInfo;
                  const cover =
                    getNovoriSearchBookCover(
                      item
                    );
                  const isbn =
                    getNovoriSearchBookIsbn(
                      item
                    );
                  return (
                    <Pressable
                      key={
                        item.id
                      }
                      onPress={() =>
                        selectBook(
                          item
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.bookResultRow,
                        pressed &&
                          styles.bookResultRowPressed,
                      ]}
                    >
                      {cover ? (
                        <BookCoverImage
                          imageLinks={
                            info.imageLinks
                          }
                          isbn={
                            isbn
                          }
                          existingCoverUrl={
                            cover
                          }
                          preferExistingCover
                          style={
                            styles.bookResultCover
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={
                            styles.bookResultCoverFallback
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
                          styles.bookResultCopy
                        }
                      >
                        <Text
                          style={
                            styles.bookResultTitle
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {info.title ??
                            'Untitled'}
                        </Text>

                        <Text
                          style={
                            styles.bookResultAuthor
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {info.authors
                            ?.join(
                              ', '
                            ) ??
                            'Unknown author'}
                        </Text>
                      </View>

                      <Ionicons
                        name="add-circle-outline"
                        size={
                          22
                        }
                        color={
                          colors.gold
                        }
                      />
                    </Pressable>
                  );
                }
              )
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
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
    loadingState: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    header: {
      minHeight: 58,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius:
        20,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerTitle: {
      position:
        'absolute',
      left: 82,
      right: 82,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 20,
      textAlign:
        'center',
    },
    headerPostButton: {
      minWidth: 62,
      height: 38,
      marginLeft:
        'auto',
      borderRadius:
        13,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        13,
    },
    headerPostButtonDisabled: {
      opacity:
        0.35,
    },
    headerPostButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    content: {
      width:
        '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      paddingHorizontal:
        18,
      paddingTop:
        14,
      paddingBottom:
        80,
    },
    destinationBar: {
      minHeight:
        56,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        10,
      paddingVertical:
        7,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    destinationBarOpen: {
      borderBottomColor:
        colors.gold,
    },
    destinationAvatar: {
      width:
        42,
      height:
        42,
      borderRadius:
        21,
      backgroundColor:
        colors.elevated,
      marginRight:
        11,
    },
    clubDestinationAvatar: {
      borderRadius:
        13,
    },
    profileAvatarFallback: {
      width:
        42,
      height:
        42,
      borderRadius:
        21,
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
        11,
    },
    profileAvatarInitial: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        17,
    },
    clubAvatarFallback: {
      width:
        42,
      height:
        42,
      borderRadius:
        13,
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
        11,
    },
    clubAvatarText: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        16,
    },
    destinationCopy: {
      flex: 1,
      minWidth: 0,
    },
    destinationEyebrow: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
      letterSpacing:
        1.1,
      marginBottom:
        2,
    },
    destinationTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        15,
    },
    destinationSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        2,
    },
    destinationChevron: {
      width:
        32,
      height:
        32,
      borderRadius:
        16,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },
    destinationDropdown: {
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
      paddingVertical:
        4,
    },
    dropdownRow: {
      minHeight:
        56,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        9,
      borderRadius:
        14,
    },
    dropdownRowSelected: {
      backgroundColor:
        colors.elevated,
    },
    dropdownAvatar: {
      width:
        36,
      height:
        36,
      borderRadius:
        18,
      marginRight:
        10,
      backgroundColor:
        colors.elevated,
    },
    dropdownAvatarFallback: {
      width:
        36,
      height:
        36,
      borderRadius:
        18,
      marginRight:
        10,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    dropdownClubFallback: {
      width:
        36,
      height:
        36,
      borderRadius:
        11,
      marginRight:
        10,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    dropdownCopy: {
      flex: 1,
      minWidth: 0,
    },
    dropdownTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    dropdownTitleSelected: {
      color:
        colors.gold,
    },
    dropdownSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10,
      marginTop:
        2,
    },
    composerRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingTop:
        16,
      paddingBottom:
        8,
    },
    composerAvatar: {
      width:
        45,
      height:
        45,
      borderRadius:
        22.5,
      marginRight:
        12,
      backgroundColor:
        colors.elevated,
    },
    composerAvatarFallback: {
      width:
        45,
      height:
        45,
      borderRadius:
        22.5,
      marginRight:
        12,
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
    composerAvatarInitial: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        18,
    },
    composerMain: {
      flex: 1,
      minWidth: 0,
    },
    composerBox: {
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        16,
      backgroundColor:
        colors.surface,
      paddingHorizontal:
        13,
      paddingVertical:
        11,
    },
    composer: {
      minHeight:
        92,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        17,
      lineHeight:
        25,
      padding:
        0,
    },
    composerMeta: {
      marginTop:
        6,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'flex-end',
    },
    counter: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10,
    },
    counterWarning: {
      color:
        colors.gold,
    },
    photoAttachment: {
      marginTop:
        16,
      marginBottom:
        2,
      alignItems:
        'center',
    },
    photoPreviewWrap: {
      width:
        '100%',
      maxWidth:
        430,
      aspectRatio:
        1,
      alignSelf:
        'center',
      borderRadius:
        20,
      overflow:
        'hidden',
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    photoPreview: {
      width:
        '100%',
      height:
        '100%',
      backgroundColor:
        colors.elevated,
    },
    photoAttachmentFooter: {
      width:
        '100%',
      maxWidth:
        430,
      alignSelf:
        'center',
      minHeight:
        42,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        12,
      paddingTop:
        10,
      paddingHorizontal:
        2,
    },
    photoAttachmentLabel: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
    },
    photoAttachmentLabelText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    photoAttachmentActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
    },
    photoAttachmentAction: {
      paddingHorizontal:
        9,
      paddingVertical:
        7,
      borderRadius:
        10,
    },
    photoAttachmentActionText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    photoAttachmentRemoveText: {
      color:
        colors.mutedText,
    },
    bookAttachment: {
      marginTop:
        12,
      minHeight:
        112,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      paddingVertical:
        12,
    },
    bookCover: {
      width:
        58,
      height:
        87,
      borderRadius:
        8,
      backgroundColor:
        colors.elevated,
      marginRight:
        13,
    },
    bookCoverFallback: {
      width:
        58,
      height:
        87,
      borderRadius:
        8,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        13,
    },
    bookCopy: {
      flex: 1,
      minWidth: 0,
      paddingRight:
        8,
    },
    bookEyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
      letterSpacing:
        0.9,
      marginBottom:
        5,
    },
    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        16,
      lineHeight:
        21,
    },
    bookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      marginTop:
        4,
    },
    bookRemoveButton: {
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
    },
    feedPreviewCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        22,
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
      marginTop:
        18,
    },
    feedPreviewHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingHorizontal:
        16,
      paddingTop:
        15,
    },
    feedPreviewAvatar: {
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
    feedPreviewAvatarFallback: {
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
    feedPreviewAvatarText: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        18,
    },
    feedPreviewAuthorCopy: {
      flex:
        1,
      minWidth:
        0,
      paddingTop:
        2,
    },
    feedPreviewIdentity: {
      flexDirection:
        'row',
      alignItems:
        'center',
      columnGap:
        6,
      minWidth:
        0,
    },
    feedPreviewAuthorName: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13.5,
      flexShrink:
        1,
    },
    feedPreviewUsername: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      flexShrink:
        1,
    },
    feedPreviewAudienceText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        5,
    },
    feedPreviewTime: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
    },
    feedPreviewContent: {
      paddingHorizontal:
        16,
      paddingTop:
        14,
      paddingBottom:
        15,
    },
    feedPreviewBodyInput: {
      minHeight:
        34,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        15,
      lineHeight:
        22,
      padding:
        0,
    },
    feedPreviewPhotoWrap: {
      alignSelf:
        'stretch',
      aspectRatio:
        1,
      marginTop:
        6,
      marginHorizontal:
        -16,
      borderRadius:
        0,
      overflow:
        'hidden',
      backgroundColor:
        colors.elevated,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },
    feedPreviewPhoto: {
      width:
        '100%',
      height:
        '100%',
    },
    feedPreviewCompactBook: {
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
    feedPreviewCompactBookCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    feedPreviewCompactBookTitle: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    feedPreviewCompactBookMeta: {
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
    feedPreviewBookCard: {
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
        7,
    },
    feedPreviewBookCover: {
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
    feedPreviewBookCoverFallback: {
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
    feedPreviewBookCopy: {
      flex:
        1,
      minWidth:
        0,
      paddingRight:
        8,
    },
    feedPreviewBookEyebrow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      marginBottom:
        5,
    },
    feedPreviewBookEyebrowText: {
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
    feedPreviewBookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      lineHeight:
        18,
    },
    feedPreviewBookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        4,
    },
    feedPreviewFooter: {
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
    feedPreviewFooterAction: {
      minHeight:
        30,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
    },
    feedPreviewFooterText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10.5,
    },
    previewAttachmentManagement: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'flex-end',
      flexWrap:
        'wrap',
      gap:
        8,
      marginTop:
        8,
    },
    previewAttachmentManagementText: {
      marginRight:
        'auto',
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10,
    },
    previewManageButton: {
      paddingHorizontal:
        8,
      paddingVertical:
        6,
      borderRadius:
        9,
    },
    previewManageButtonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
    },

    attachmentToolbar: {
      marginTop:
        22,
      paddingTop:
        16,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },
    attachmentToolbarTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
      marginBottom:
        11,
    },
    attachmentActions: {
      flexDirection:
        'row',
      gap:
        10,
    },
    attachmentAction: {
      flex: 1,
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        16,
      paddingHorizontal:
        12,
      backgroundColor:
        colors.surface,
    },
    attachmentActionActive: {
      borderColor:
        colors.gold,
    },
    attachmentIcon: {
      width:
        34,
      height:
        34,
      borderRadius:
        12,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        9,
    },
    attachmentActionText: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    footerNote: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
      paddingTop:
        18,
      paddingHorizontal:
        2,
    },
    footerNoteText: {
      flex: 1,
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
    },
    pressed: {
      opacity:
        0.68,
    },
    bookPickerSafeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },
    bookPickerHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingHorizontal:
        14,
      paddingTop:
        8,
      paddingBottom:
        14,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    bookPickerHeaderButton: {
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
      marginRight:
        6,
    },
    bookPickerHeaderCopy: {
      flex: 1,
      paddingTop:
        3,
      paddingRight:
        12,
    },
    bookPickerTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        21,
    },
    bookPickerSubtitle: {
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
    bookSearchBar: {
      marginHorizontal:
        18,
      marginTop:
        14,
      minHeight:
        48,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        9,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        16,
      backgroundColor:
        colors.surface,
      paddingHorizontal:
        13,
    },
    bookSearchInput: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      paddingVertical:
        11,
    },
    bookResultsContent: {
      paddingHorizontal:
        18,
      paddingTop:
        12,
    },
    bookSearchState: {
      minHeight:
        220,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        28,
    },
    bookSearchStateTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        18,
      textAlign:
        'center',
      marginTop:
        10,
    },
    bookSearchStateText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      lineHeight:
        17,
      textAlign:
        'center',
      marginTop:
        6,
    },
    bookResultRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      minHeight:
        92,
      paddingVertical:
        9,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    bookResultRowPressed: {
      opacity:
        0.65,
    },
    bookResultCover: {
      width:
        48,
      height:
        72,
      borderRadius:
        6,
      marginRight:
        12,
      backgroundColor:
        colors.elevated,
    },
    bookResultCoverFallback: {
      width:
        48,
      height:
        72,
      borderRadius:
        6,
      marginRight:
        12,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    bookResultCopy: {
      flex: 1,
      minWidth: 0,
      paddingRight:
        10,
    },
    bookResultTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      lineHeight:
        18,
    },
    bookResultAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        4,
    },
  });
}
