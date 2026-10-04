import {buildCommentThreads,countThreadReplies,getCommentDepthLimit,getFocusedConversationId,getCommentAncestorPath} from '../src/lib/comment-conversations';
const comment=(id,parent=null,score=0)=>({id,parent_comment_id:parent,created_at:'2026-10-03T10:00:00Z',vote_score:score});
test('sibling order preserves top/newest and optimistic replies without changing the inputs',()=>{
 const items=[comment('root'),comment('low','root',1),{...comment('new','root',2),created_at:'2026-10-03T11:00:00Z'},comment('high','root',10),comment('optimistic-1','root')];
 expect(buildCommentThreads(items,'top').roots[0].children.map(n=>n.id)).toEqual(['optimistic-1','high','new','low']);
 expect(buildCommentThreads(items,'newest').roots[0].children.map(n=>n.id)).toEqual(['optimistic-1','new','high','low']);
 expect(items.every(item=>!item.children)).toBe(true);
});
test('orphaned, self-parented, and cyclic comments remain reachable without recursive loops',()=>{
 const result=buildCommentThreads([comment('orphan','deleted'),comment('self','self'),comment('a','b'),comment('b','a'),comment('child','a')],'top');
 expect(result.roots.map(n=>n.id).sort()).toEqual(['a','b','orphan','self']);
 expect(countThreadReplies(result.nodes.get('a'))).toBe(1);
});
test('long conversations are counted and sorted without a recursive stack overflow',()=>{
 const items=Array.from({length:1500},(_,i)=>comment('c'+i,i?'c'+(i-1):null));
 const result=buildCommentThreads(items,'top');expect(countThreadReplies(result.roots[0])).toBe(1499);
 expect(getFocusedConversationId(items,'','c1499',2)).toBe('c1499');
});
test('available width bounds indentation, deep notification links focus their own branch',()=>{
 expect([280,390,800].map(getCommentDepthLimit)).toEqual([1,2,3]);
 const items=[comment('root'),comment('c1','root'),comment('c2','c1'),comment('c3','c2')];
 expect(getFocusedConversationId(items,'','c2',2)).toBe('c2');
 expect(getFocusedConversationId(items,'','c3',2)).toBe('c3');
 expect(getFocusedConversationId(items,'root','c3',2)).toBe('root');
 expect(getFocusedConversationId(items,'missing','',2)).toBe('missing');
});

test('branch deletion preserves unrelated comments and safely handles long/cyclic branches',()=>{
 const {getCommentBranchIds}=require('../src/lib/comment-conversations');const items=[comment('root'),comment('child','root'),comment('grandchild','child'),comment('other'),comment('other-child','other')];expect([...getCommentBranchIds(items,'root')].sort()).toEqual(['child','grandchild','root']);
 expect(getCommentBranchIds([comment('a','b'),comment('b','a')],'a').size).toBe(2);expect(getCommentBranchIds(Array.from({length:1500},(_,i)=>comment('c'+i,i?'c'+(i-1):null)),'c0').size).toBe(1500);
});

test('focused context includes only the original parent and its path, never other reply branches',()=>{
 const items=[comment('root'),comment('a','root'),comment('selected','a'),comment('sibling','root'),comment('unrelated'),comment('reply','selected')];const tree=buildCommentThreads(items,'top');expect(getCommentAncestorPath(tree.nodes,'selected').map(c=>c.id)).toEqual(['root','a']);expect(getCommentAncestorPath(tree.nodes,'root')).toEqual([]);expect(getCommentAncestorPath(tree.nodes,'missing')).toEqual([]);expect(tree.nodes.get('selected').children.map(c=>c.id)).toEqual(['reply']);
});
test('ancestor paths preserve deleted parents and stay iterative for malformed or deep threads',()=>{
 const items=[{...comment('deleted'),is_deleted:true},comment('child','deleted'),comment('orphan','missing'),comment('self','self'),comment('a','b'),comment('b','a')];const tree=buildCommentThreads(items,'top');expect(getCommentAncestorPath(tree.nodes,'child')[0].is_deleted).toBe(true);for(const id of ['orphan','self','a','b'])expect(getCommentAncestorPath(tree.nodes,id)).toEqual([]);
 const deep=buildCommentThreads(Array.from({length:1500},(_,i)=>comment('c'+i,i?'c'+(i-1):null)),'top');expect(getCommentAncestorPath(deep.nodes,'c1499')).toHaveLength(1499);
});
