import {
  Platform,
  Share,
} from 'react-native';

function shareContent(message: string, url: string) {
  // iOS treats `url` as a separate share item. Including it in `message`
  // as well sends the same link twice. Android shares the combined text.
  return Platform.OS === 'ios'
    ? { message, url }
    : { message: `${message}\n${url}` };
}

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

  await Share.share(shareContent('Check out this post on Novori', url));
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

  await Share.share(shareContent(
    cleanName
      ? `Check out ${cleanName} on Novori`
      : 'Check out this Book Stack on Novori',
    url,
  ));
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

  await Share.share(shareContent(
    cleanTitle
      ? `Check out ${cleanTitle} on Novori`
      : 'Check out this book on Novori',
    url,
  ));
}

export function getProfileShareUrl(readerId: string) {
  return buildShareUrl(`/reader/${encodeURIComponent(readerId)}`);
}

export async function shareProfileLink({ readerId, name }: { readerId: string; name?: string | null }) {
  const label = name?.trim();
  await Share.share(shareContent(label ? `Check out ${label} on Novori` : 'Check out this reader on Novori', getProfileShareUrl(readerId)));
}

export function getClubShareUrl(clubId: string) {
  return buildShareUrl(`/club/${encodeURIComponent(clubId)}`);
}

export async function shareClubLink({ clubId, name }: { clubId: string; name?: string | null }) {
  const label = name?.trim();
  await Share.share(shareContent(label ? `Join ${label} on Novori` : 'Check out this club on Novori', getClubShareUrl(clubId)));
}

export function getClubEventShareUrl(eventId: string) {
  return buildShareUrl(`/club-event/${encodeURIComponent(eventId)}`);
}

export async function shareClubEventLink({ eventId, title }: { eventId: string; title?: string | null }) {
  const label = title?.trim();
  await Share.share(shareContent(label ? `Check out ${label} on Novori` : 'Check out this club event on Novori', getClubEventShareUrl(eventId)));
}
