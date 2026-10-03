import {
  FeedPost,
} from './feed';

export function getPostEditRoute(
  post: FeedPost
) {
  if (post.club_event) return {pathname:'/create-club-event' as const,params:{clubId:post.club_event.club_id,eventId:post.club_event.id}};
  if (post.reading_recap) {
    return { pathname: '/share-reading-recap' as const, params: { editPostId: post.id } };
  }
  if (
    post.post_type ===
    'question'
  ) {
    return {
      pathname:
        '/ask-readers' as const,
      params: {
        editPostId:
          post.id,
      },
    };
  }

  if (
    post.post_type ===
    'reading_update'
  ) {
    return {
      pathname:
        '/create-reading-update' as const,
      params: {
        editPostId:
          post.id,
      },
    };
  }

  if (
    post.post_type ===
      'book_stack' &&
    post.book_stack_id
  ) {
    return {
      pathname:
        '/create-book-stack' as const,
      params: {
        editPostId:
          post.id,
        stackId:
          post.book_stack_id,
      },
    };
  }

  return {
    pathname:
      '/create-post' as const,
    params: {
      editPostId:
        post.id,
    },
  };
}
