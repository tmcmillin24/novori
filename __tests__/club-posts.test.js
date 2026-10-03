const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
function load(file,requireFn){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:requireFn,Error,console});return exports;}
function harness({posts=[],pins=[],details={},pinError=null,detailError=null}={}){
  const calls=[],mutations=[];const query={select:()=>query,eq:()=>query,order:()=>query,limit:async()=>({data:pins,error:null})};
  const supabase={from:table=>{calls.push(['table',table]);return query;},rpc:async(name,args)=>{calls.push([name,args]);return name==='get_visible_club_pins'?{data:pins,error:null}:{error:pinError};}};
  const feed={getClubPosts:async id=>{calls.push(['recent',id]);return posts;},getPostDetail:async id=>{calls.push(['detail',id]);if(detailError)throw detailError;return details[id];},markPostMutation:()=>mutations.push(true)};
  const api=load('club-posts.ts',name=>name==='./supabase'?{supabase}:name==='./feed'?feed:name==='./club-event'?load('club-event.ts',()=>{throw Error('Provider import')}):(()=>{throw Error('No book/provider dependency: '+name)})());return {api,calls,mutations};
}
test.each(['post','question','reading_update','review','book_stack'])('pins preserve %s posts and stored book media without book calls',async type=>{
  const post={id:'p1',club_id:'c1',post_type:type,book_cover_url:'stored-cover',book_authors:['Author']};const h=harness({posts:[post],pins:[{post_id:'p1'}]});
  const result=await h.api.getClubConversation('c1');expect(result.posts[0]).toBe(post);expect(result.pinnedPosts[0]).toBe(post);expect(h.calls).toEqual([['recent','c1'],['get_visible_club_pins',{target_club_id:'c1'}]]);
});
test('old pins load only missing details, retaining pin order',async()=>{
  const recent={id:'p1',club_id:'c1'},old={id:'p0',club_id:'c1'};const h=harness({posts:[recent],pins:[{post_id:'p0'},{post_id:'p1'}],details:{p0:old}});
  const result=await h.api.getClubConversation('c1');expect(result.posts).toEqual([recent]);expect(result.pinnedPosts).toEqual([old,recent]);expect(h.calls.filter(c=>c[0]==='detail')).toEqual([['detail','p0']]);
});
test('deleted and moved pinned posts are never shown',async()=>{
  const missing=harness({pins:[{post_id:'p0'}],detailError:new Error('This post is unavailable.')});expect((await missing.api.getClubConversation('c1')).pinnedPosts).toEqual([]);
  const moved=harness({pins:[{post_id:'p0'}],details:{p0:{id:'p0',club_id:'other'}}});expect((await moved.api.getClubConversation('c1')).pinnedPosts).toEqual([]);
});
test('transport failures are surfaced instead of silently dropping pins',async()=>{
  const h=harness({pins:[{post_id:'p0'}],detailError:new Error('Network unavailable')});await expect(h.api.getClubConversation('c1')).rejects.toThrow('Network unavailable');
});
test('pin replacement is a single atomic RPC and invalidates post views only on success',async()=>{
  const h=harness();await h.api.setClubPostPin('c1','p1',true,'old');expect(h.calls).toEqual([['set_club_post_pin',{target_club_id:'c1',target_post_id:'p1',pin_post:true,replace_post_id:'old'}]]);expect(h.mutations).toEqual([true]);
  const failed=harness({pinError:new Error('Permission changed')});await expect(failed.api.setClubPostPin('c1','p1',false)).rejects.toThrow('Permission changed');expect(failed.mutations).toEqual([]);
});
test('only owner and admin roles manage club posts',()=>{const h=harness();for(const role of ['owner','admin'])expect(h.api.canManageClubPosts(role)).toBe(true);for(const role of ['member',null,undefined,''])expect(h.api.canManageClubPosts(role)).toBe(false);});

function feedHarness({rows=[],signedIn=true}={}){
  const calls=[];const query={insert:value=>{calls.push(['insert',value]);return query;},update:value=>{calls.push(['update',value]);return query;},eq:()=>query,select:value=>{calls.push(['select',value]);return query;},in:async()=>({data:rows,error:null}),single:async()=>({data:{id:'post'},error:null})};
  const supabase={auth:{getUser:async()=>({data:{user:signedIn?{id:'owner'}:null}})},from:()=>query};
  const api=load('feed.ts',name=>name==='./supabase'?{supabase}:name==='./reading-recap-card'?{parseReadingRecapSnapshot:value=>value??null}:name==='./club-event'?load('club-event.ts',()=>{throw Error('Provider import')}):name==='./club-discussion'?load('club-discussion.ts',()=>{throw Error('Provider import')}):(()=>{throw Error('No cover/provider dependency '+name)})());return {api,calls};
}
test('announcement publication uses the ordinary post write with stored media',async()=>{
  const h=feedHarness();await h.api.createPost({body:' Welcome! ',clubId:'c1',isClubAnnouncement:true,bookCoverUrl:'stored-cover',bookAuthors:['Author']});
  expect(h.calls[0][1]).toMatchObject({body:'Welcome!',club_id:'c1',post_type:'post',is_club_announcement:true,book_cover_url:'stored-cover',book_authors:['Author']});
});
test('ordinary posts omit the announcement field; edits preserve the original flag',async()=>{
  const h=feedHarness();await h.api.createPost({body:'Hello'});expect(h.calls[0][1]).not.toHaveProperty('is_club_announcement');
  await h.api.updatePost('post',{body:'Edited',clubId:'c1'});expect(h.calls.find(c=>c[0]==='update')[1]).not.toHaveProperty('is_club_announcement');
});
test('feed, profile, detail and club metadata hydration keeps announcement and media identities',async()=>{
  const h=feedHarness({rows:[{id:'p1',is_club_announcement:true,book_authors:['Author'],post_image_url:'photo',book_stack_id:null,reading_recap:null}]});
  const [post]=await h.api.attachPostImageUrls([{id:'p1',book_cover_url:'stored-cover',body:'Welcome'}]);expect(post.is_club_announcement).toBe(true);expect(post.book_cover_url).toBe('stored-cover');expect(post.book_authors).toEqual(['Author']);expect(h.calls.filter(c=>c[0]==='select')).toHaveLength(1);
});
test('announcements cannot target the feed, a different post type, or a signed-out write',async()=>{
  const h=feedHarness();await expect(h.api.createPost({body:'Hello',isClubAnnouncement:true})).rejects.toThrow('club');await expect(h.api.createPost({body:'Hello',clubId:'c1',postType:'question',isClubAnnouncement:true})).rejects.toThrow('club');expect(h.calls).toEqual([]);
  const anon=feedHarness({signedIn:false});await expect(anon.api.createPost({body:'Hello',clubId:'c1',isClubAnnouncement:true})).rejects.toThrow('signed in');expect(anon.calls).toEqual([]);
});
