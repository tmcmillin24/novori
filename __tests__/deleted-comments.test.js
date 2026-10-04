import { getPostComments } from '../src/lib/comments';
import { supabase } from '../src/lib/supabase';
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getUser: jest.fn() }, rpc: jest.fn() } }));
test('anonymous rows always show deletion notices and carry no navigable identity', async () => {
 supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'reader' } }, error: null });
 supabase.rpc.mockResolvedValue({ data: [{ id: 'parent', author_id: null, body: 'stale text', author_display_name: 'stale name', author_username: 'stale username', author_avatar_url: 'stale avatar', is_own: true }, { id: 'reply', parent_comment_id: 'parent', author_id: 'other', body: 'Keep this reply', author_display_name: 'Other reader' }], error: null });
 const [parent, reply] = await getPostComments('post');
 expect(parent).toMatchObject({ author_id: '', body: 'This comment was deleted.', author_display_name: 'Deleted user', author_username: null, author_avatar_url: null, is_own: false, is_deleted: true });
 expect(reply).toMatchObject({ parent_comment_id: 'parent', author_id: 'other', body: 'Keep this reply', is_deleted: false });
});

test('adding and deleting comments invalidate cached profile comment counts', async () => {
 const {createPostComment,deletePostComment}=require('../src/lib/comments');
 const {getPostMutationVersion}=require('../src/lib/feed');
 supabase.auth.getUser.mockResolvedValue({data:{user:{id:'reader'}},error:null});
 supabase.rpc.mockResolvedValue({data:'comment',error:null});
 const before=getPostMutationVersion();await createPostComment('post','A comment');expect(getPostMutationVersion()).toBe(before+1);
 await deletePostComment('comment');expect(getPostMutationVersion()).toBe(before+2);
});
