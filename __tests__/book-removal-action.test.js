const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app/book/[id]/index.tsx'),'utf8');
const code=source.slice(source.indexOf('  function confirmRemoveFromLibrary()'),source.indexOf('  function openReadingDateEditor()'));
test('removal requires confirmation, uses the existing delete and invalidates stale private reads',async()=>{
 const deps={displayBookTitle:value=>value,book:{id:'book',volumeInfo:{title:'A Book'}},savedBook:{status:'reading'},savingStatus:null,removingBook:false,savedStatusVersion:{current:0},Alert:{alert:jest.fn()},setRemoveConfirmTarget:jest.fn(),setRemovingBook:jest.fn(),removeUserBook:jest.fn(async()=>{}),setConfirmedReadingStatus:jest.fn(),setSavedBook:jest.fn(),setReadingStatus:jest.fn(),console:{error:jest.fn()}};
 const exports={};vm.runInNewContext(ts.transpileModule(code+'\nexports.confirm=confirmRemoveFromLibrary;exports.remove=removeFromLibrary;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...deps,exports});
 exports.confirm();expect(deps.removeUserBook).not.toHaveBeenCalled();expect(deps.Alert.alert).not.toHaveBeenCalled();expect(deps.setRemoveConfirmTarget).toHaveBeenCalledWith({title:'A Book',hasReadingDetails:true});
 await exports.remove();
 expect(deps.removeUserBook).toHaveBeenCalledWith('book');expect(deps.savedStatusVersion.current).toBe(1);expect(deps.setSavedBook).toHaveBeenCalledWith(null);
});
test('failed removal rejects so the shared confirmation stays open for retry',async()=>{
 const deps={displayBookTitle:value=>value,book:{id:'book'},savedBook:{status:'reading'},savingStatus:null,removingBook:false,savedStatusVersion:{current:0},Alert:{alert:jest.fn()},setRemoveConfirmTarget:jest.fn(),setRemovingBook:jest.fn(),removeUserBook:jest.fn(async()=>{throw Error('offline');}),setConfirmedReadingStatus:jest.fn(),setSavedBook:jest.fn(),setReadingStatus:jest.fn(),console:{error:jest.fn()}};
 const exports={};vm.runInNewContext(ts.transpileModule(code+'\nexports.remove=removeFromLibrary;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...deps,exports});
 await expect(exports.remove()).rejects.toThrow('offline');expect(deps.setSavedBook).not.toHaveBeenCalled();expect(deps.setRemovingBook).toHaveBeenLastCalledWith(false);
});
