const fs=require('fs'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync('src/app/(tabs)/profile.tsx','utf8');
const start=source.indexOf('                const [bookResult, socialResult');const end=source.indexOf('                const mergedProfilePosts',start);
async function run({booksFail=false,clubsFail=false,active=true}={}){
 const ctx={exports:{},savedBooksPromise:booksFail?Promise.reject(Error('network lost')):Promise.resolve([]),getReaderProfile:async()=>({follower_count:7,following_count:8}),getReaderProfilePosts:async()=>[],getHomeFeed:async()=>[],getReaderPublicClubs:async()=>{if(clubsFail)throw Error('network lost');return ['club'];},getMyBookStacks:async()=>['stack'],user:{id:'me'},isMounted:active,profileReadController:new AbortController(),error:null,setFollowerCount:jest.fn(),setFollowingCount:jest.fn(),setClubs:jest.fn(),setStacks:jest.fn(),setProfileRefreshWarning:jest.fn()};
 const code='async function run(){'+source.slice(start,end)+'exports.reachedSnapshot=true;}exports.run=run;';
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);await ctx.exports.run();return ctx;
}
it('a failed books request does not discard successfully refreshed followers and does not overwrite the cache',async()=>{
 const h=await run({booksFail:true});expect(h.setFollowerCount).toHaveBeenCalledWith(7);expect(h.setFollowingCount).toHaveBeenCalledWith(8);expect(h.setStacks).toHaveBeenCalledWith(['stack']);expect(h.setProfileRefreshWarning).toHaveBeenCalledWith(true);expect(h.exports.reachedSnapshot).toBeUndefined();
});
it('a failed clubs request preserves the current clubs instead of replacing them with an empty list',async()=>{const h=await run({clubsFail:true});expect(h.setClubs).not.toHaveBeenCalled();expect(h.setProfileRefreshWarning).toHaveBeenCalledWith(true);expect(h.exports.reachedSnapshot).toBeUndefined();});
it('late section results after blur do not update the screen or cache',async()=>{const h=await run({active:false});expect(h.setFollowerCount).not.toHaveBeenCalled();expect(h.setProfileRefreshWarning).not.toHaveBeenCalled();expect(h.exports.reachedSnapshot).toBeUndefined();});
it('only a complete refresh proceeds to a fresh cache snapshot',async()=>{const h=await run();expect(h.exports.reachedSnapshot).toBe(true);expect(h.setProfileRefreshWarning).toHaveBeenCalledWith(false);});
