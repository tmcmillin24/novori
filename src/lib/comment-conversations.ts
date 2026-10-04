import type { PostComment } from './comments';

export type CommentThread = PostComment & { children: CommentThread[] };

/** IDs removed by a cascading comment deletion, without recursion or cycle risk. */
export function getCommentBranchIds(comments:PostComment[],rootId:string){
  const children=new Map<string,string[]>();
  for(const comment of comments){
    if(!comment.parent_comment_id)continue;
    const siblings=children.get(comment.parent_comment_id)??[];
    siblings.push(comment.id);children.set(comment.parent_comment_id,siblings);
  }
  const ids=new Set<string>();const pending=[rootId];
  while(pending.length){const id=pending.pop()!;if(ids.has(id))continue;ids.add(id);pending.push(...(children.get(id)??[]));}
  return ids;
}

export function getCommentDepthLimit(width: number) {
  return width < 320 ? 1 : width < 560 ? 2 : 3;
}

export function buildCommentThreads(comments: PostComment[], sort: 'top' | 'newest') {
  const nodes = new Map(comments.map(comment => [comment.id, { ...comment, children: [] } as CommentThread]));
  const roots: CommentThread[] = [];
  for (const node of nodes.values()) {
    let parent = node.parent_comment_id ? nodes.get(node.parent_comment_id) : undefined;
    const seen = new Set<string>();
    let ancestor = parent;
    while (ancestor) {
      if (ancestor.id === node.id) { parent = undefined; break; }
      // A cycle above this comment will be broken at its own nodes.
      if (seen.has(ancestor.id)) break;
      seen.add(ancestor.id);
      ancestor = ancestor.parent_comment_id ? nodes.get(ancestor.parent_comment_id) : undefined;
    }
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const compare = (a: CommentThread, b: CommentThread) => {
    const optimistic = Number(b.id.startsWith('optimistic-')) - Number(a.id.startsWith('optimistic-'));
    return optimistic || (sort === 'top' ? (b.vote_score ?? 0) - (a.vote_score ?? 0) : 0)
      || Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id);
  };
  // Sorting and counting stay iterative even when conversations are very deep.
  const queue = [roots];
  while (queue.length) {
    const siblings = queue.pop()!;
    siblings.sort(compare);
    for (const node of siblings) if (node.children.length) queue.push(node.children);
  }
  return { roots, nodes };
}

export function countThreadReplies(thread: CommentThread) {
  let count = 0;
  const pending = [...thread.children];
  while (pending.length) {
    const next = pending.pop()!;
    count++;
    pending.push(...next.children);
  }
  return count;
}

export function getFocusedConversationId(comments: PostComment[], requested: string, target: string, limit: number) {
  if (requested) return requested;
  const nodes = new Map(comments.map(comment => [comment.id, comment]));
  let current = nodes.get(target);
  let depth = 0;
  const seen = new Set<string>();
  while (current?.parent_comment_id && nodes.has(current.parent_comment_id) && !seen.has(current.id)) {
    seen.add(current.id);
    depth++;
    current = nodes.get(current.parent_comment_id);
  }
  return depth > limit ? (nodes.get(target)?.parent_comment_id ?? target) : '';
}
