import React from 'react';
import renderer,{act} from 'react-test-renderer';
import ProfileReadingModule from '../src/components/ProfileReadingModule';
import {getDailyReadingCheckinState,ensureDailyReadingCheckin} from '../src/lib/reading-checkins';
const mockListeners=new Set();
let mockAppState='active',mockFocus,mockFocusCleanup;
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()}),useFocusEffect:callback=>{mockFocus=callback;require('react').useEffect(()=>{mockFocusCleanup=callback();return()=>mockFocusCleanup?.();},[callback]);}}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native',()=>({ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:v=>v},Platform:{select:v=>v.ios??v.default},Alert:{alert:jest.fn()},AppState:{get currentState(){return mockAppState;},addEventListener:(_event,callback)=>{mockListeners.add(callback);return{remove:()=>mockListeners.delete(callback)};}}}));
jest.mock('../src/components/DailyCheckinSheet',()=> 'DailyCheckinSheet');
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/lib/reading-checkins',()=>({...jest.requireActual('../src/lib/reading-checkins'),getDailyReadingCheckinState:jest.fn(),ensureDailyReadingCheckin:jest.fn().mockResolvedValue('checkin')}));
jest.mock('../src/lib/supabase',()=>({supabase:{}}));
const empty={localDate:'2026-10-27',checkedIn:false,currentStreak:0,checkedDates:[]};
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.useFakeTimers().setSystemTime(new Date('2026-10-27T12:00:00Z'));jest.clearAllMocks();mockListeners.clear();mockAppState='active';getDailyReadingCheckinState.mockResolvedValue(empty);silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;jest.useRealTimers();silence.mockRestore();});
async function render(books=[]){await act(async()=>{view=renderer.create(<ProfileReadingModule books={books}/>);});}
async function state(value){await act(async()=>{mockAppState=value;for(const listener of [...mockListeners])listener(value);});}
const pastDayFilled=()=>view.root.findAllByType('Text').find(node=>node.props.children===26).parent.props.style.some(style=>style?.backgroundColor===require('../src/constants/novori-theme').DARK_COLORS.gold);
const checked={...empty,currentStreak:2,checkedDates:['2026-10-25','2026-10-26']};
test('same-day resume fills past days without visiting Reading Tracker',async()=>{
 await render();expect(pastDayFilled()).toBe(false);
 getDailyReadingCheckinState.mockResolvedValue(checked);
 await state('background');await state('active');
 expect(getDailyReadingCheckinState).toHaveBeenCalledTimes(2);expect(pastDayFilled()).toBe(true);
 await state('active');expect(getDailyReadingCheckinState).toHaveBeenCalledTimes(2);
});
test('blur detaches foreground refreshes and refocusing still reloads',async()=>{
 await render();await act(async()=>mockFocusCleanup());
 await state('background');await state('active');expect(getDailyReadingCheckinState).toHaveBeenCalledTimes(1);
 getDailyReadingCheckinState.mockResolvedValue(checked);await act(async()=>{mockFocusCleanup=mockFocus();});
 expect(pastDayFilled()).toBe(true);
});
test('an older foreground request cannot overwrite newer check-in dates',async()=>{
 await render();let oldResult,newResult;
 getDailyReadingCheckinState.mockImplementationOnce(()=>new Promise(resolve=>{oldResult=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{newResult=resolve;}));
 await state('background');await state('active');await state('background');await state('active');
 await act(async()=>newResult(checked));expect(pastDayFilled()).toBe(true);
 await act(async()=>oldResult(empty));expect(pastDayFilled()).toBe(true);
});
test('a failed refresh retains the filled dates and retries next time',async()=>{
 getDailyReadingCheckinState.mockResolvedValue(checked);await render();
 getDailyReadingCheckinState.mockRejectedValueOnce(new Error('offline'));
 await state('background');await state('active');expect(pastDayFilled()).toBe(true);
 await state('background');await state('active');expect(getDailyReadingCheckinState).toHaveBeenCalledTimes(3);expect(pastDayFilled()).toBe(true);
});
test('resuming after midnight reads the new date only once',async()=>{
 await render();await state('background');jest.setSystemTime(new Date('2026-10-28T08:00:00Z'));
 getDailyReadingCheckinState.mockResolvedValue({...checked,localDate:'2026-10-28'});await state('active');
 expect(getDailyReadingCheckinState.mock.calls.map(args=>args[0])).toEqual(['2026-10-27','2026-10-28']);
});

test('a background refresh cannot undo a check-in saved from the already-open picker',async()=>{
 await render([{google_book_id:'book-1',status:'reading'},{google_book_id:'book-2',status:'reading'}]);
 await act(async()=>view.root.findByProps({accessibilityLabel:'Check in for today’s reading'}).props.onPress());
 await act(async()=>view.root.findByType('DailyCheckinSheet').props.onToggleBook('book-1'));
 let oldResult;getDailyReadingCheckinState.mockImplementationOnce(()=>new Promise(resolve=>{oldResult=resolve;}));
 await state('background');await state('active');
 getDailyReadingCheckinState.mockResolvedValue({...checked,checkedIn:true,checkedDates:[...checked.checkedDates,'2026-10-27']});
 await act(async()=>view.root.findByType('DailyCheckinSheet').props.onConfirm());
 expect(ensureDailyReadingCheckin).toHaveBeenCalledWith(['book-1'],'manual','2026-10-27');
 await act(async()=>oldResult(empty));
 expect(view.root.findByProps({accessibilityLabel:'Checked in for today’s reading'})).toBeDefined();
 expect(pastDayFilled()).toBe(true);
});
