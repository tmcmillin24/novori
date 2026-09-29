import {
  ImageProps,
} from 'react-native';
import {
  Image as ExpoImage,
} from 'expo-image';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BookImageLinks,
  getBookCoverPlan,
  resolveBestBookCover,
} from '../lib/book-covers';

type Props = Omit<
  ImageProps,
  'source'
> & {
  imageLinks?: BookImageLinks;
  isbn?: string | null;
  existingCoverUrl?: string | null;
  preferExistingCover?: boolean;
};

export default function BookCoverImage({
  imageLinks,
  isbn,
  existingCoverUrl,
  preferExistingCover = false,
  onError,
  resizeMode,
  ...imageProps
}: Props) {
  const plan =
    useMemo(
      () =>
        getBookCoverPlan({
          imageLinks,
          isbn,
          existingCoverUrl,
        }),
      [
        imageLinks,
        isbn,
        existingCoverUrl,
      ]
    );

  const preferredExistingUrl =
    preferExistingCover &&
    existingCoverUrl
      ? existingCoverUrl.replace(
          'http://',
          'https://'
        )
      : null;

  const [
    activeUrl,
    setActiveUrl,
  ] =
    useState<string | null>(
      preferredExistingUrl ??
      plan.primaryUrl
    );

  useEffect(
    () => {
      let cancelled =
        false;

      setActiveUrl(
        preferredExistingUrl ??
        plan.primaryUrl
      );

      if (
        preferredExistingUrl
      ) {
        return () => {
          cancelled =
            true;
        };
      }

      void resolveBestBookCover({
        imageLinks,
        isbn,
        existingCoverUrl,
      }).then(
        (
          resolved
        ) => {
          if (
            !cancelled &&
            resolved.url
          ) {
            setActiveUrl(
              resolved.url
            );
          }
        }
      );

      return () => {
        cancelled =
          true;
      };
    },
    [
      imageLinks,
      isbn,
      existingCoverUrl,
      preferExistingCover,
      preferredExistingUrl,
      plan.primaryUrl,
    ]
  );

  if (
    !activeUrl
  ) {
    return null;
  }

  const contentFit =
    resizeMode ===
      'contain'
      ? 'contain'
      : resizeMode ===
          'center'
        ? 'none'
        : resizeMode ===
            'stretch'
          ? 'fill'
          : 'cover';

  return (
    <ExpoImage
      {...(
        imageProps as any
      )}
      source={{
        uri:
          activeUrl,
      }}
      cachePolicy="memory-disk"
      contentFit={
        contentFit
      }
      transition={0}
      recyclingKey={
        activeUrl
      }
      onError={(
        event
      ) => {
        if (
          preferredExistingUrl &&
          activeUrl ===
            preferredExistingUrl &&
          plan.primaryUrl &&
          plan.primaryUrl !==
            preferredExistingUrl
        ) {
          setActiveUrl(
            plan.primaryUrl
          );
          return;
        }

        if (
          plan.fallbackUrl &&
          activeUrl !==
            plan.fallbackUrl
        ) {
          setActiveUrl(
            plan.fallbackUrl
          );
          return;
        }

        onError?.(
          event as any
        );
      }}
    />
  );
}
