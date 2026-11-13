import {applyCommentDeletion,pruneDeletedCommentLeaves} from '../src/lib/comment-deletion';
import type {PostComment} from '../src/lib/comments';
const row=(id:string,parent:string|null=null,deleted=false)=>({id,parent_comment_id:parent,author_id:deleted?'':'reader',body:'Text',is_deleted:deleted,is_own:!deleted} as PostComment);
it('removes a leaf and retains unrelated comments',()=>{expect(applyCommentDeletion([row('a'),row('b')],'a').map(c=>c.id)).toEqual(['b']);});
it('masks only the author comment and keeps replies and their ancestry',()=>{
 const result=applyCommentDeletion([row('a'),row('b','a'),row('c','b')],'a');
 expect(result.map(c=>c.id)).toEqual(['a','b','c']);expect(result[0]).toMatchObject({is_deleted:true,author_id:'',body:'This comment was deleted.',is_own:false});expect(result[1].body).toBe('Text');
});
it('removes now-empty deleted ancestors when their last live reply is removed',()=>{expect(applyCommentDeletion([row('a',null,true),row('b','a',true),row('c','b')],'c')).toEqual([]);});
it('handles deleted-only cycles and keeps ancestors with live descendants',()=>{
 expect(pruneDeletedCommentLeaves([row('a','b',true),row('b','a',true)])).toEqual([]);
 expect(pruneDeletedCommentLeaves([row('a','b',true),row('b','a',true),row('c','a')]).length).toBe(3);
});
