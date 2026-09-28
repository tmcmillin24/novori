import {
  Share,
} from 'react-native';

function cleanBaseUrl(
  value:
    string | undefined
) {
  const trimmed =
    value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(
    /\/+$/,
    ''
  );
}

const publicShareBaseUrl =
  cleanBaseUrl(
    process.env
      .EXPO_PUBLIC_NOVORI_SHARE_BASE_URL
  );

function buildShareUrl(
  path: string
) {
  if (
    publicShareBaseUrl
  ) {
    return `${publicShareBaseUrl}${path}`;
  }

  return `novori://${path.replace(
    /^\//,
    ''
  )}`;
}

export function getPostShareUrl(
  postId: string
) {
  return buildShareUrl(
    `/post/${encodeURIComponent(
      postId
    )}`
  );
}

export function getBookShareUrl(
  googleBookId: string
) {
  const encodedId =
    encodeURIComponent(
      googleBookId
    );

  if (
    publicShareBaseUrl
  ) {
    return `${publicShareBaseUrl}/book/${encodedId}?source=shared`;
  }

  return `novori://book/${encodedId}?source=shared`;
}

export async function sharePostLink(
  postId: string
) {
  const url =
    getPostShareUrl(
      postId
    );

  await Share.share({
    message:
      `Check out this post on Novori\n${url}`,
    url,
  });
}

export function getBookStackShareUrl(
  stackId: string
) {
  return buildShareUrl(
    `/stack/${encodeURIComponent(
      stackId
    )}`
  );
}

export async function shareBookStackLink({
  stackId,
  name,
}: {
  stackId: string;
  name?: string | null;
}) {
  const url =
    getBookStackShareUrl(
      stackId
    );

  const cleanName =
    name?.trim();

  await Share.share({
    message:
      cleanName
        ? `Check out ${cleanName} on Novori\n${url}`
        : `Check out this Book Stack on Novori\n${url}`,
    url,
  });
}

export async function shareBookLink({
  googleBookId,
  title,
}: {
  googleBookId: string;
  title?: string | null;
}) {
  const url =
    getBookShareUrl(
      googleBookId
    );

  const cleanTitle =
    title?.trim();

  await Share.share({
    message:
      cleanTitle
        ? `Check out ${cleanTitle} on Novori\n${url}`
        : `Check out this book on Novori\n${url}`,
    url,
  });
}
