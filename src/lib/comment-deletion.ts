import type { PostComment } from './comments';

// Keep a removed node only when it connects a surviving reply to its ancestors.
export function pruneDeletedCommentLeaves(comments: PostComment[]): PostComment[] {
  const nodes = new Map(comments.map(comment => [comment.id, comment]));
  const keep = new Set<string>();
  for (const comment of comments) {
    if (comment.is_deleted) continue;
    const visited = new Set<string>();
    let current: PostComment | undefined = comment;
    while (current && !visited.has(current.id)) {
      visited.add(current.id); keep.add(current.id);
      current = current.parent_comment_id ? nodes.get(current.parent_comment_id) : undefined;
    }
  }
  return comments.filter(comment => keep.has(comment.id));
}
export function applyCommentDeletion(comments: PostComment[], id: string) {
  return pruneDeletedCommentLeaves(comments.map(comment => comment.id !== id ? comment : {
    ...comment, author_id: '', author_display_name: 'Deleted user', author_username: null,
    author_avatar_url: null, body: 'This comment was deleted.', is_deleted: true, is_own: false,
    viewer_vote: 0 as const, vote_score: 0, upvote_count: 0, downvote_count: 0,
  }));
}
