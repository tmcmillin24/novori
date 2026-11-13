const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app/book/[id]/index.tsx'),'utf8');
const code=source.slice(source.indexOf('  function confirmRemoveFromLibrary()'),source.indexOf('  function openReadingDateEditor()'));
test('removal requires confirmation, uses the existing delete and invalidates stale private reads',async()=>{
 const deps={book:{id:'book',volumeInfo:{title:'A Book'}},savedBook:{status:'reading'},savingStatus:null,removingBook:false,savedStatusVersion:{current:0},Alert:{alert:jest.fn()},setRemovingBook:jest.fn(),removeUserBook:jest.fn(async()=>{}),setConfirmedReadingStatus:jest.fn(),setSavedBook:jest.fn(),setReadingStatus:jest.fn(),console:{error:jest.fn()}};
 const exports={};vm.runInNewContext(ts.transpileModule(code+'\nexports.confirm=confirmRemoveFromLibrary;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...deps,exports});
 exports.confirm();expect(deps.removeUserBook).not.toHaveBeenCalled();
 const [title,message,actions]=deps.Alert.alert.mock.calls[0];expect(title).toMatch(/Remove from Library/);expect(message).toMatch(/notes/);
 expect(actions.find(action=>action.style==='cancel')).toBeDefined();await actions.find(action=>action.style==='destructive').onPress();
 expect(deps.removeUserBook).toHaveBeenCalledWith('book');expect(deps.savedStatusVersion.current).toBe(1);expect(deps.setSavedBook).toHaveBeenCalledWith(null);
});
