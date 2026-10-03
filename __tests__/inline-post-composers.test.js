import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import CreateReadingUpdateScreen from '../src/app/create-reading-update';
import CreateBookStackScreen from '../src/app/create-book-stack';
import AskReadersScreen from '../src/app/ask-readers';
import CreatePostScreen from '../src/app/create-post';
import PostTypeIdentifier from '../src/components/PostTypeIdentifier';
import EditablePostCard from '../src/components/EditablePostCard';
import PostDestinationPicker from '../src/components/PostDestinationPicker';
import BookStackShowcase from '../src/components/BookStackShowcase';
import { getUserBooks } from '../src/lib/user-books';
import { publishReadingUpdate, updateReadingUpdate } from '../src/lib/reading-updates';
import { createBookStack, updateBookStack, deleteBookStack, getBookStack } from '../src/lib/book-stacks';
import { createPost, updatePost, getPostDetail } from '../src/lib/feed';
import { searchNovoriBooks } from '../src/lib/book-search';
import { getMyClubs } from '../src/lib/clubs';

let mockParams = {};
let mockProfile;
const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native', () => ({
  AppState:{addEventListener:()=>({remove:()=>{}})},ActivityIndicator: 'ActivityIndicator', Image: 'Image', Pressable: 'Pressable',
  ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View',
  Modal: ({ visible, ...props }) => visible ? require('react').createElement('Modal', props) : null,
  StyleSheet: { create: (value) => value, hairlineWidth: 1 },
  Alert: { alert: jest.fn() },
  Keyboard: { dismiss: jest.fn() },
  Animated: {
    View: 'AnimatedView',
    Value: class { setValue() {} stopAnimation() {} },
    timing: () => ({ start: (callback) => callback?.({ finished: true }) }),
    spring: () => ({ start: (callback) => callback?.({ finished: true }) }),
    parallel: () => ({ start: (callback) => callback?.({ finished: true }) }),
  },
  Easing: { cubic: 'cubic', in: (value) => value, out: (value) => value },
  PanResponder: { create: () => ({ panHandlers: {} }) },
  TurboModuleRegistry: { get: () => null },
  Platform: { OS: 'ios', select: (options) => options.ios ?? options.default },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));
jest.mock('expo-image-picker',()=>({}));
jest.mock('../src/components/PhotoSourceSheet',()=> 'PhotoSourceSheet');
jest.mock('../src/components/PostPhotoCropper',()=> 'PostPhotoCropper');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardAwareScrollView: 'KeyboardAwareScrollView' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('../src/context/theme-context', () => ({
  useNovoriTheme: () => ({ colors: require('../src/constants/novori-theme').DARK_COLORS }),
}));
jest.mock('../src/components/BookCoverImage', () => 'BookCoverImage');
jest.mock('../src/components/CanonicalBookRating', () => 'CanonicalBookRating');
jest.mock('../src/components/BookStackVisual', () => 'BookStackVisual');
jest.mock('../src/components/SortableBookStackRow', () => 'SortableBookStackRow');
jest.mock('../src/lib/user-books', () => ({ getUserBooks: jest.fn() }));
jest.mock('../src/lib/reading-updates', () => ({ publishReadingUpdate: jest.fn(), updateReadingUpdate: jest.fn() }));
jest.mock('../src/lib/book-stacks', () => ({ createBookStack: jest.fn(), updateBookStack: jest.fn(), deleteBookStack: jest.fn(), getBookStack: jest.fn() }));
jest.mock('../src/lib/feed', () => ({ createPost: jest.fn(), updatePost: jest.fn(), getPostDetail: jest.fn() }));
jest.mock('../src/lib/book-search', () => ({
  searchNovoriBooks: jest.fn(), resolveHardcoverRating: jest.fn(),
  getNovoriSearchBookCover: (book) => `https://covers/${book.id}.jpg`,
}));
jest.mock('../src/lib/canonical-book-covers', () => ({ resolveCanonicalBookCover: ({ googleBookId }) => Promise.resolve(`https://covers/${googleBookId}.jpg`) }));
jest.mock('../src/lib/clubs', () => ({ getMyClubs: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'reader' } } }) },
    from: () => {
      const query = { select: () => query, eq: () => query,
        single: () => Promise.resolve({ data: mockProfile }) };
      return query;
    },
  },
}));

const books = ['book-a', 'book-b'].map((id) => ({
  id, google_book_id: id, title: id, authors: ['Author'], cover_url: `https://covers/${id}.jpg`,
}));
const stack = { id: 'stack-1', name: 'Favorites', items: books };
let view;
let consoleError;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockParams = {};
  mockProfile = { display_name: 'Reader', username: 'reader', avatar_url: 'https://profiles/reader.jpg' };
  getMyClubs.mockResolvedValue([{ id: 'club-1', name: 'Our readers', cover_url: 'https://clubs/our-readers.jpg' }]);
  getUserBooks.mockResolvedValue(books);
  getBookStack.mockResolvedValue(stack);
  createBookStack.mockResolvedValue(stack);
  updateBookStack.mockResolvedValue(stack);
  deleteBookStack.mockResolvedValue(undefined);
  createPost.mockResolvedValue({ id: 'new-post' });
  updatePost.mockResolvedValue({ id: 'post-1' });
  publishReadingUpdate.mockResolvedValue('new-update');
  updateReadingUpdate.mockResolvedValue('update-1');
  searchNovoriBooks.mockResolvedValue(books.map((book) => ({ id: book.id, volumeInfo: { title: book.title, authors: book.authors } })));
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
  view = null;
  jest.useRealTimers();
  consoleError.mockRestore();
});
async function renderScreen(Component) {
  await act(async () => { view = renderer.create(<Component />); });
}
function field(label) { return view.root.findAllByType('TextInput').find((node) => node.props.accessibilityLabel === label); }
function button(label) { return view.root.findAllByType('Pressable').find((node) => node.props.accessibilityLabel === label); }
async function fill(label, value) { await act(async () => field(label).props.onChangeText(value)); }
async function press(label) { await act(async () => button(label).props.onPress()); }
async function buildNewStack(caption = '') {
  await renderScreen(CreateBookStackScreen);
  await fill('Stack name', 'Favorites');
  await fill('Optional text about this stack', caption);
  await press('Add books to stack');
  const search = view.root.findByProps({ placeholder: 'Search title or author' });
  await act(async () => search.props.onChangeText('books'));
  await act(async () => jest.advanceTimersByTime(700));
  for (const book of books) {
    const result = view.root.findAllByType('Pressable').find((node) =>
      node.findAllByType('BookCoverImage').some((cover) => cover.props.googleBookId === book.id));
    await act(async () => result.props.onPress());
  }
  await act(async () => view.root.findByType('Modal').props.onRequestClose());
}

test('Reading Update publishes directly with entered progress, thought and source note, once per tap sequence', async () => {
  mockParams = { bookId: 'book-a', sourceNoteId: 'note-1', progress: '50' };
  await renderScreen(CreateReadingUpdateScreen);
  await fill('Current page', '245');
  await fill('Your reading update thoughts (optional)', 'A great chapter');
  const publish = button('Publish Reading Update').props.onPress;
  await act(async () => { publish(); publish(); });
  expect(publishReadingUpdate).toHaveBeenCalledTimes(1);
  expect(publishReadingUpdate).toHaveBeenCalledWith({ googleBookId: 'book-a', progress: '245', chapter: '', audioPosition: '', thought: 'A great chapter', sourceNoteId: 'note-1', clubId: null });
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});

test('Reading Update still allows a thought without progress', async () => {
  getUserBooks.mockResolvedValue([books[0]]);
  await renderScreen(CreateReadingUpdateScreen);
  await fill('Your reading update thoughts (optional)', 'Just started this!');
  await press('Publish Reading Update');
  expect(publishReadingUpdate).toHaveBeenCalledWith(expect.objectContaining({ progress: '', thought: 'Just started this!', googleBookId: 'book-a' }));
});

test('editing an audiobook update preloads its original book and updates the existing post', async () => {
  mockParams = { editPostId: 'update-1' };
  getPostDetail.mockResolvedValue({ post_type: 'reading_update', google_book_id: 'book-b', body: 'Audio 1:23:45\n\nOriginal thought', club_id: null, club_name: null });
  await renderScreen(CreateReadingUpdateScreen);
  expect(field('Audiobook time').props.value).toBe('1:23:45');
  expect(view.root.findAllByType('BookCoverImage').map((cover) => cover.props.googleBookId)).toEqual(['book-b']);
  await fill('Audiobook time', '2:10:05');
  await fill('Your reading update thoughts (optional)', 'Updated thought');
  await press('Save Reading Update changes');
  expect(updateReadingUpdate).toHaveBeenCalledWith('update-1', { googleBookId: 'book-b', progress: '', chapter: '', audioPosition: '2:10:05', thought: 'Updated thought', clubId: null });
  expect(publishReadingUpdate).not.toHaveBeenCalled();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('stack Save & Post uses inline text, destination and reordered books without another screen', async () => {
  await buildNewStack('  Books I loved  ');
  await press('Post to Your feed');
  const clubOption = view.root.findAllByType('Pressable').find((node) => node.findAllByType('Text').some((text) => text.props.children === 'Our readers'));
  await act(async () => clubOption.props.onPress());
  const card = view.root.findByType(EditablePostCard);
  expect(card.findAllByType(PostDestinationPicker)).toHaveLength(0);
  expect(card.findAllByType('Text').some((node) => node.props.children === 'in Our readers')).toBe(true);
  expect(getMyClubs).toHaveBeenCalledTimes(1);
  const firstRow = view.root.findAllByType('SortableBookStackRow')[0];
  await act(async () => firstRow.props.onDragStart('book-a', 0));
  await act(async () => firstRow.props.onDragMove('book-a', 80));
  expect(view.root.findByType('BookStackVisual').props.items.map((book) => book.google_book_id)).toEqual(['book-b', 'book-a']);
  await act(async () => firstRow.props.onDragEnd());
  const publish = button('Save and publish Book Stack').props.onPress;
  await act(async () => { publish(); publish(); });
  expect(createBookStack).toHaveBeenCalledTimes(1);
  expect(createBookStack.mock.calls[0][1].map((book) => book.googleBookId)).toEqual(['book-b', 'book-a']);
  expect(createPost).toHaveBeenCalledTimes(1);
  expect(createPost).toHaveBeenCalledWith({ body: 'Books I loved', postType: 'book_stack', bookStackId: 'stack-1', clubId: 'club-1' });
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
});

test('stack text starts compact, grows and shrinks with its content, and remains optional', async () => {
  await buildNewStack();
  expect(field('Optional text about this stack').props.style[1].height).toBe(22);
  await fill('Optional text about this stack', 'First line\nSecond line\nThird line');
  await act(async () => field('Optional text about this stack').props.onContentSizeChange({ nativeEvent: { contentSize: { height: 66 } } }));
  expect(field('Optional text about this stack').props.style[1].height).toBe(66);
  await fill('Optional text about this stack', '');
  await act(async () => field('Optional text about this stack').props.onContentSizeChange({ nativeEvent: { contentSize: { height: 22 } } }));
  expect(field('Optional text about this stack').props.style[1].height).toBe(22);
  await press('Save and publish Book Stack');
  expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ body: '', postType: 'book_stack' }));
});

test('saving a stack without posting never creates a feed post', async () => {
  await buildNewStack('A caption for later');
  await press('Save stack to profile without posting');
  expect(createBookStack).toHaveBeenCalledTimes(1);
  expect(createPost).not.toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile');
});

test('editing a stack post preserves its destination and edits the existing stack and post', async () => {
  mockParams = { stackId: 'stack-1', editPostId: 'post-1' };
  getPostDetail.mockResolvedValue({ body: 'Old text', club_id: 'club-1', club_name: 'Our readers' });
  await renderScreen(CreateBookStackScreen);
  expect(field('Stack name').props.value).toBe('Favorites');
  expect(field('Optional text about this stack').props.value).toBe('Old text');
  await fill('Stack name', 'New favorites');
  await fill('Optional text about this stack', 'New text');
  await press('Save Book Stack post changes');
  expect(updateBookStack).toHaveBeenCalledWith('stack-1', 'New favorites', expect.any(Array));
  expect(updatePost).toHaveBeenCalledWith('post-1', { body: 'New text', allowEmptyBody: true, clubId: 'club-1' });
  expect(createBookStack).not.toHaveBeenCalled();
  expect(createPost).not.toHaveBeenCalled();
});

test('a failed stack publication cleans up the new stack and leaves the inline draft available to retry', async () => {
  await buildNewStack('Try this stack');
  createPost.mockRejectedValueOnce(new Error('Offline'));
  await press('Save and publish Book Stack');
  expect(deleteBookStack).toHaveBeenCalledWith('stack-1');
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Could not publish stack', 'Offline');
  expect(field('Stack name').props.value).toBe('Favorites');
  expect(field('Optional text about this stack').props.value).toBe('Try this stack');
  await press('Save and publish Book Stack');
  expect(createPost).toHaveBeenCalledTimes(2);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
});

test('published stack showcases keep their read-only title and feed layout', async () => {
  await act(async () => { view = renderer.create(<BookStackShowcase name="Favorites" items={books} variant="feed" />); });
  expect(view.root.findAllByType('TextInput')).toHaveLength(0);
  expect(view.root.findByType('BookStackVisual').props.variant).toBe('feed');
});


test('Reading Update can choose a joined club and shows its cached photo', async () => {
  getUserBooks.mockResolvedValue([books[0]]);
  await renderScreen(CreateReadingUpdateScreen);
  await press('Post to Your feed');
  const photo = view.root.findAllByType('ExpoImage').find((node) => node.props.source.uri === 'https://clubs/our-readers.jpg');
  expect(photo.props.source.uri).toBe('https://clubs/our-readers.jpg');
  expect(photo.props.cachePolicy).toBe('memory-disk');
  const club = view.root.findAllByType('Pressable').find((node) => node.findAllByType('Text').some((text) => text.props.children === 'Our readers'));
  await act(async () => club.props.onPress());
  const card = view.root.findByType(EditablePostCard);
  expect(card.findAllByType(PostDestinationPicker)).toHaveLength(0);
  expect(card.findAllByType('Text').some((node) => node.props.children === 'in Our readers')).toBe(true);
  expect(getMyClubs).toHaveBeenCalledTimes(1);
  await fill('Current page', '123');
  await press('Publish Reading Update');
  expect(publishReadingUpdate).toHaveBeenCalledWith(expect.objectContaining({ clubId: 'club-1', progress: '123' }));
});

test('Ask Readers chooses a destination above the card and publishes the displayed choice', async () => {
  await renderScreen(AskReadersScreen);
  await fill('Your question', 'What should I read next?');
  await press('Post to Your feed');
  await press('Choose Our readers');
  expect(view.root.findAllByType('Text').some((node) => node.props.children === 'in Our readers')).toBe(true);
  expect(button('Post to Our readers')).toBeDefined();
  await press('Publish Ask Readers post');
  expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ body: 'What should I read next?', clubId: 'club-1', postType: 'question' }));
  expect(getMyClubs).toHaveBeenCalledTimes(1);
});

test.each([
  ['Reading Update', CreateReadingUpdateScreen],
  ['Ask Readers', AskReadersScreen],
  ['Book Stack', CreateBookStackScreen],
])('%s keeps the reader photo in the dropdown and hides it from the selected feed bar', async (_, Screen) => {
  await renderScreen(Screen);
  const picker = view.root.findByType(PostDestinationPicker);
  expect(picker.findAllByType('ExpoImage')).toHaveLength(0);
  await press('Post to Your feed');
  const feedOption = button('Choose Your feed');
  expect(feedOption.findByType('ExpoImage').props.source.uri).toBe('https://profiles/reader.jpg');
  expect(feedOption.findByType('ExpoImage').props.cachePolicy).toBe('memory-disk');
  await press('Choose Our readers');
  expect(picker.findByType('ExpoImage').props.source.uri).toBe('https://clubs/our-readers.jpg');
  await press('Post to Our readers');
  await press('Choose Your feed');
  expect(picker.findAllByType('ExpoImage')).toHaveLength(0);
  expect(view.root.findAllByType('Image').filter((node) => node.props.source?.uri === 'https://profiles/reader.jpg')).toHaveLength(1);
});

test.each(['Save stack to profile without posting', 'Save and publish Book Stack'])('%s uses dismissible animated validation warnings and preserves the draft', async (action) => {
  await renderScreen(CreateBookStackScreen);
  await press(action);
  expect(view.root.findAllByType('Text').some((node) => node.props.children === 'Name your stack')).toBe(true);
  expect(view.root.findByType('Modal').props.animationType).toBe('none');
  await act(async () => view.root.findByType('Modal').props.onShow());
  expect(view.root.findAllByType('AnimatedView')).toHaveLength(2);
  await press('Dismiss warning');
  expect(view.root.findAllByType('Modal')).toHaveLength(0);
  await fill('Stack name', 'Favorites');
  await fill('Optional text about this stack', 'Keep this draft');
  await press(action);
  expect(view.root.findAllByType('Text').some((node) => node.props.children === 'A Book Stack needs at least 2 books.')).toBe(true);
  await act(async () => view.root.findByType('Modal').props.onRequestClose());
  expect(view.root.findAllByType('Modal')).toHaveLength(0);
  expect(field('Stack name').props.value).toBe('Favorites');
  expect(field('Optional text about this stack').props.value).toBe('Keep this draft');
  expect(createBookStack).not.toHaveBeenCalled();
  expect(createPost).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('announcement composer is the editable post card, locks its club, and publishes directly',async()=>{
  mockParams={clubId:'club-1',announcement:'1'};getMyClubs.mockResolvedValue([{id:'club-1',name:'Our readers',membership_role:'admin',cover_url:'club-photo'}]);
  await renderScreen(CreatePostScreen);await fill('Post text','Next meeting is Friday.');expect(button('Publish post').props.disabled).toBe(false);
  expect(view.root.findByType(PostTypeIdentifier).props.announcement).toBe(true);
  expect(view.root.findAllByType('Text').some(node=>node.props.children==='POST TO')).toBe(false);
  await press('Publish post');expect(createPost).toHaveBeenCalledWith(expect.objectContaining({body:'Next meeting is Friday.',clubId:'club-1',isClubAnnouncement:true}));
  expect(mockRouter.replace).toHaveBeenCalledWith({pathname:'/club/[id]',params:{id:'club-1'}});expect(Alert.alert).not.toHaveBeenCalled();
});
test('members and invalid club destinations cannot publish announcements',async()=>{
  mockParams={clubId:'club-1',announcement:'1'};getMyClubs.mockResolvedValue([{id:'club-1',name:'Our readers',membership_role:'member'}]);
  await renderScreen(CreatePostScreen);await fill('Post text','Hello');expect(button('Publish post').props.disabled).toBe(true);await press('Publish post');expect(createPost).not.toHaveBeenCalled();
});
test('editing an announcement preserves stored covers, authors, and the fixed destination',async()=>{
  mockParams={editPostId:'post-1'};getMyClubs.mockResolvedValue([{id:'club-1',name:'Our readers',membership_role:'owner'}]);
  getPostDetail.mockResolvedValue({id:'post-1',author_id:'reader',club_id:'club-1',is_club_announcement:true,body:'Original',book_title:'Book',google_book_id:'cached-book',book_cover_url:'cached-cover',book_authors:['Stored author']});
  await renderScreen(CreatePostScreen);expect(field('Post text').props.value).toBe('Original');await fill('Post text','Updated');await press('Save post');
  expect(updatePost).toHaveBeenCalledWith('post-1',expect.objectContaining({clubId:'club-1',body:'Updated',bookCoverUrl:'cached-cover',bookAuthors:['Stored author']}));expect(searchNovoriBooks).not.toHaveBeenCalled();
});
