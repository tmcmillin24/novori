import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ReadingInsightStats from '../src/components/ReadingInsightStats';
import PeriodReadingInsights from '../src/components/PeriodReadingInsights';
import ReadingRecapPostAttachment from '../src/components/ReadingRecapPostAttachment';
import { parseReadingInsights, getReadingInsightStats } from '../src/lib/reading-insights';
import { parseReadingRecapSnapshot } from '../src/lib/reading-recap-card';
import { supabase } from '../src/lib/supabase';

jest.mock('react-native', () => ({ Text: 'Text', View: 'View', Pressable: 'Pressable', Platform: { OS: 'ios', select: value => value.ios ?? value.default }, TurboModuleRegistry: { get: () => null }, StyleSheet: { create: v => v, absoluteFill: {}, hairlineWidth: .5 } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: require('../src/constants/novori-theme').DARK_COLORS }) }));
jest.mock('../src/components/BookCoverImage', () => 'BookCoverImage');
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getUser: jest.fn() }, rpc: jest.fn() } }));
let view, silence;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); silence = jest.spyOn(console,'error').mockImplementation(()=>{});
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'reader' } } }); supabase.rpc.mockResolvedValue({ data: {} }); });
afterEach(async()=>{if(view) await act(async()=>view.unmount());view=null;silence.mockRestore();});
async function render(element){await act(async()=>{view=renderer.create(element);});}
function text(){return view.root.findAllByType('Text').map(node=>node.props.children).join(' ');}
const snapshot={schemaVersion:1,kind:'month',periodStart:'2025-01-01',periodEndExclusive:'2025-02-01',throughDate:'2025-01-31',finishedBooks:1,daysRead:2,bestStreak:1,books:[]};

test('absent, zero, and empty metrics render no section',async()=>{
  await render(<ReadingInsightStats insights={{pagesTracked:0,audiobookJourneys:0}}/>);expect(view.toJSON()).toBeNull();
  expect(getReadingInsightStats({})).toEqual([]);expect(getReadingInsightStats(undefined)).toEqual([]);
});
test('a reader without audio sees only applicable metrics and no audio label',async()=>{
  await render(<ReadingInsightStats insights={{pagesTracked:80,authorsRead:2,rereads:1}}/>);
  expect(text()).toContain('pages tracked');expect(text()).toContain('authors read');expect(text()).not.toContain('audiobook');
});
test('recorded audio shows journeys without inventing listening duration',async()=>{
  await render(<ReadingInsightStats insights={{audiobookJourneys:1}}/>);expect(text()).toContain('audiobook journeys');expect(text()).not.toContain('pages');expect(text()).not.toMatch(/hours|minutes/);
});
test.each([null,[],{pagesTracked:-1},{authorsRead:1.5},{rereads:'2'},{audiobookJourneys:Infinity}])('malformed metrics fail closed %o',value=>{
  expect(parseReadingInsights(value)).toBeNull();expect(getReadingInsightStats(value)).toEqual([]);
});
test('legacy snapshots still parse; valid insights retain the exact server object for publication',()=>{
  expect(parseReadingRecapSnapshot(snapshot)).toBe(snapshot);const enhanced={...snapshot,insights:{rereads:1}};
  expect(parseReadingRecapSnapshot(enhanced)).toBe(enhanced);expect(parseReadingRecapSnapshot({...snapshot,insights:{rereads:-1}})).toBeNull();
});
test('shared attachment uses frozen insights without reading private history',async()=>{
  await render(<ReadingRecapPostAttachment snapshot={{...snapshot,insights:{authorsRead:1}}}/>);
  expect(text()).toContain('authors read');expect(text()).not.toContain('audiobook');expect(supabase.rpc).not.toHaveBeenCalled();
});
test('private period insights perform one read and keep absent stats absent',async()=>{
  supabase.rpc.mockResolvedValue({data:{rereads:1}});await render(<PeriodReadingInsights start="2025-01-01" end="2025-02-01" revision={0}/>);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);expect(supabase.rpc.mock.calls[0][0]).toBe('get_reading_insights');expect(text()).toContain('rereads');expect(text()).not.toContain('audiobook');
});
test('a late previous-period response cannot overwrite the current period',async()=>{
  let resolve;supabase.rpc.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  await render(<PeriodReadingInsights start="2025-01-01" end="2025-02-01" revision={0}/>);
  supabase.rpc.mockResolvedValue({data:{authorsRead:2}});
  await act(async()=>view.update(<PeriodReadingInsights start="2025-02-01" end="2025-03-01" revision={0}/>));
  await act(async()=>resolve({data:{audiobookJourneys:99}}));expect(text()).toContain('authors read');expect(text()).not.toContain('audiobook');
});
test('failures show a retry without invented zeroes or provider fallbacks',async()=>{
  supabase.rpc.mockResolvedValueOnce({error:{message:'Offline'}});await render(<PeriodReadingInsights start="2025-01-01" end="2025-02-01" revision={0}/>);
  expect(text()).toContain('retry');supabase.rpc.mockResolvedValue({data:{pagesTracked:20}});
  await act(async()=>view.root.findByType('Pressable').props.onPress());expect(text()).toContain('pages tracked');expect(supabase.rpc).toHaveBeenCalledTimes(2);
});
