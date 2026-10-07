const fs=require('fs'),vm=require('vm'),parser=require('@babel/parser');
const source=fs.readFileSync(require('path').join(__dirname,'../src/app/(tabs)/index.tsx'),'utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['typescript','jsx']});
function find(predicate,node=ast){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const value of Object.values(node)){if(Array.isArray(value)){for(const child of value){const match=find(predicate,child);if(match)return match;}}else if(value && typeof value==='object') {const match=find(predicate,value);if(match)return match;}}return null;}
function prop(element,name,visible){const attribute=element.attributes.find(a=>a.name?.name===name);expect(attribute).toBeDefined();return vm.runInNewContext(source.slice(attribute.value.expression.start,attribute.value.expression.end),{commentsModalVisible:visible});}
test('opening comments blocks background feed touches, scrolling, status-bar scroll-to-top and accessibility; dismissal restores them',()=>{
 const feed=find(n=>n.type==='JSXOpeningElement'&&n.name.name==='ScrollView'&&n.attributes.some(a=>a.name?.name==='ref'&&a.value?.expression?.name==='homeScrollRef'));
 const surface=find(n=>n.type==='JSXOpeningElement'&&n.name.name==='SafeAreaView');
 for(const visible of [true,false]){
  expect(prop(feed,'scrollEnabled',visible)).toBe(!visible);
  expect(prop(feed,'scrollsToTop',visible)).toBe(!visible);
  expect(prop(surface,'pointerEvents',visible)).toBe(visible?'none':'auto');
  expect(prop(surface,'accessibilityElementsHidden',visible)).toBe(visible);
 }
});
test('a stale opening-animation flag cannot prevent dismissal and duplicate taps close only once',()=>{
 const node=find(n=>n.type==='FunctionDeclaration'&&n.id?.name==='closeCommentsSheet');
 let complete;
 const context={commentsSheetAnimating:{current:true},commentsSheetClosing:{current:false},activeCommentsPostId:{current:'post'},commentsViewGeneration:{current:1},commentsReadSequence:{current:1},commentsSheetCurrentHeight:{current:700},Keyboard:{dismiss:jest.fn()},commentsMotion:{close:jest.fn(callback=>{complete=callback;})},setCommentsModalVisible:jest.fn()};
 const close=vm.runInNewContext('(function()'+source.slice(node.body.start,node.body.end)+')',context);
 close();close();expect(context.commentsMotion.close).toHaveBeenCalledTimes(1);expect(context.activeCommentsPostId.current).toBeNull();expect(context.setCommentsModalVisible).not.toHaveBeenCalled();complete();expect(context.setCommentsModalVisible).toHaveBeenCalledWith(false);expect(context.commentsSheetClosing.current).toBe(false);expect(context.commentsSheetAnimating.current).toBe(false);
});
