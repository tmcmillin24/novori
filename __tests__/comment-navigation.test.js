const {StackRouter,StackActions}=require('expo-router/build/react-navigation/routers/StackRouter');

test('Back from repeated continued conversations preserves each prior route instance',()=>{
 const options={routeNames:['(tabs)','post/[id]','post/[id]/conversation'],routeParamList:{},routeGetIdList:{}};
 const router=StackRouter({initialRouteName:'(tabs)'});
 let state=router.getInitialState(options);
 state=router.getStateForAction(state,StackActions.push('post/[id]',{id:'post-1'}),options);
 const postRoute=state.routes[state.index];
 state=router.getStateForAction(state,StackActions.push('post/[id]/conversation',{id:'post-1',threadId:'parent'}),options);
 const firstConversation=state.routes[state.index];
 state=router.getStateForAction(state,StackActions.push('post/[id]/conversation',{id:'post-1',threadId:'child'}),options);
 expect(state.routes).toHaveLength(4);
 state=router.getStateForAction(state,{type:'GO_BACK'},options);
 expect(state.routes[state.index]).toBe(firstConversation);
 state=router.getStateForAction(state,{type:'GO_BACK'},options);
 expect(state.routes[state.index]).toBe(postRoute);
 expect(state.routes).toHaveLength(2);
});
