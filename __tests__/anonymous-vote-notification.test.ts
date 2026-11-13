import {anonymizeVoteNotification} from '../src/lib/anonymous-vote-notification';
import type {NovoriNotification} from '../src/lib/notifications';
it.each(['post_vote','comment_vote'])('removes voter name, avatar, body and navigable actor for %s',type=>{
 const n={type,title:'Tristan upvoted',actor_id:'reader',actor_display_name:'Tristan',actor_username:'tristan',actor_avatar_url:'avatar',image_url:'image',body:'Tristan',metadata:{vote_value:1,post_id:'post',comment_id:'comment'}} as unknown as NovoriNotification;
 const result=anonymizeVoteNotification(n);
 expect(JSON.stringify(result)).not.toContain('Tristan');expect(result.actor_id).toBeNull();expect(result.actor_avatar_url).toBeNull();expect(result.body).toBeNull();expect(result.metadata.post_id).toBe('post');expect(result.title).toBe(`Someone upvoted your ${type==='post_vote'?'post':'comment'}.`);
});
it('preserves named comments and anonymizes downvote inbox wording',()=>{
 const comment={type:'comment',title:'Tristan commented'} as unknown as NovoriNotification;expect(anonymizeVoteNotification(comment)).toBe(comment);
 expect(anonymizeVoteNotification({type:'post_vote',metadata:{vote_value:-1}} as unknown as NovoriNotification).title).toBe('Someone downvoted your post.');
});
