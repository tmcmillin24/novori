import {
  Image,
  ImageProps,
  ImageSourcePropType,
} from 'react-native';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BookImageLinks,
  getBookCoverPlan,
} from '../lib/book-covers';

type Props = Omit<
  ImageProps,
  'source'
> & {
  imageLinks?: BookImageLinks;
  isbn?: string | null;
  existingCoverUrl?: string | null;
};

export default function BookCoverImage({
  imageLinks,
  isbn,
  existingCoverUrl,
  onError,
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

  const [
    activeUrl,
    setActiveUrl,
  ] =
    useState<string | null>(
      plan.primaryUrl
    );

  useEffect(
    () => {
      setActiveUrl(
        plan.primaryUrl
      );
    },
    [
      plan.primaryUrl,
      plan.fallbackUrl,
    ]
  );

  if (
    !activeUrl
  ) {
    return null;
  }

  const source:
    ImageSourcePropType = {
      uri:
        activeUrl,
      cache:
        'reload',
    };

  return (
    <Image
      {...imageProps}
      source={
        source
      }
      onError={(
        event
      ) => {
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
          event
        );
      }}
    />
  );
}
