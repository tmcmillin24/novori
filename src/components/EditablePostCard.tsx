import { useRef, type ReactNode } from 'react';
import type { FeedPost, FeedPostType } from '../lib/feed';
import type { PostComposerProfile } from '../hooks/use-post-composer-profile';
import FeedPostCard from './FeedPostCard';

type Props = {
  children: ReactNode;
  postType: FeedPostType;
  clubId?: string | null;
  clubName?: string | null;
  clubCoverUrl?: string | null;
  author?: PostComposerProfile | null;
  announcement?: boolean;
  readingRecap?: boolean;
  discussion?: FeedPost['club_discussion'];
  eventLabel?: boolean;
  discussionLabel?: boolean;
  event?: FeedPost['club_event'];
  source?: FeedPost | null;
};

const noop = () => {};

export default function EditablePostCard({
  children, postType, clubId = null, clubName, clubCoverUrl, author,
  announcement, readingRecap, discussion, event, eventLabel, discussionLabel, source,
}: Props) {
  const stamp = useRef(new Date().toISOString()).current;
  const post: FeedPost = {
    id:'draft', author_id:'draft-author', post_type:postType,
    body:'', google_book_id:null, book_title:null, book_cover_url:null,
    book_authors:null, book_series_name:null, book_series_position:null, post_image_url:null,
    rating:null, book_stack_id:null, created_at:stamp, updated_at:stamp,
    author_display_name:author?.display_name ?? null, author_username:author?.username ?? null,
    author_avatar_url:author?.avatar_url ?? null, club_privacy:null,
    upvote_count:0, downvote_count:0, vote_score:0, viewer_vote:0, comment_count:0,
    ...source,
    club_id:clubId, club_name:clubName ?? source?.club_name ?? null,
    club_cover_url:clubCoverUrl ?? source?.club_cover_url ?? null,
    is_club_announcement:announcement ?? source?.is_club_announcement,
    club_discussion:discussion ?? source?.club_discussion,
    club_event:event ?? source?.club_event,
  };
  return <FeedPostCard post={post} editor={children} editorReadingRecap={readingRecap} editorEvent={eventLabel} editorDiscussion={discussionLabel}
    onComments={noop} onVote={noop} onShare={noop} onMore={noop}/>;
}
