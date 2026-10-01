export type ReadingMonthCharmCategory =
  | 'reading'
  | 'cozy'
  | 'nature'
  | 'cute'
  | 'halloween'
  | 'christmas'
  | 'summer'
  | 'celebrations';

export type ReadingMonthCharm =
  | 'book-stack'
  | 'open-book'
  | 'bookmark'
  | 'glasses'
  | 'headphones'
  | 'pen'
  | 'notebook'
  | 'library'
  | 'mug'
  | 'tea'
  | 'candle'
  | 'scarf'
  | 'fire'
  | 'cookie'
  | 'chocolate'
  | 'croissant'
  | 'plant'
  | 'sun'
  | 'moon'
  | 'flower'
  | 'leaves'
  | 'mushroom'
  | 'rain'
  | 'butterfly'
  | 'cat'
  | 'dog'
  | 'paw'
  | 'frog'
  | 'teddy'
  | 'heart'
  | 'bee'
  | 'snail'
  | 'pumpkin'
  | 'ghost'
  | 'bat'
  | 'skull'
  | 'spider'
  | 'web'
  | 'candy'
  | 'black-cat'
  | 'christmas-tree'
  | 'gift'
  | 'santa'
  | 'snowman'
  | 'bell'
  | 'stocking'
  | 'gingerbread'
  | 'snowflake'
  | 'sunglasses'
  | 'watermelon'
  | 'ice-cream'
  | 'beach'
  | 'wave'
  | 'shell'
  | 'palm'
  | 'sun-face'
  | 'fireworks'
  | 'sparkler'
  | 'usa-flag'
  | 'balloon'
  | 'confetti'
  | 'cake'
  | 'star'
  | 'ribbon'
  | 'globe';

export type ReadingMonthCharmOption = {
  id:
    ReadingMonthCharm;
  label:
    string;
  emoji:
    string;
  category:
    ReadingMonthCharmCategory;
};

export const READING_MONTH_CHARM_CATEGORIES: Array<{
  id:
    ReadingMonthCharmCategory;
  label:
    string;
  emoji:
    string;
}> = [
  {
    id:
      'reading',
    label:
      'Reading',
    emoji:
      '📚',
  },
  {
    id:
      'cozy',
    label:
      'Cozy',
    emoji:
      '☕',
  },
  {
    id:
      'nature',
    label:
      'Nature',
    emoji:
      '🌿',
  },
  {
    id:
      'cute',
    label:
      'Cute',
    emoji:
      '🐾',
  },
  {
    id:
      'halloween',
    label:
      'Halloween',
    emoji:
      '🎃',
  },
  {
    id:
      'christmas',
    label:
      'Christmas',
    emoji:
      '🎄',
  },
  {
    id:
      'summer',
    label:
      'Summer',
    emoji:
      '☀️',
  },
  {
    id:
      'celebrations',
    label:
      'Celebrate',
    emoji:
      '🎆',
  },
];

export const READING_MONTH_CHARM_OPTIONS: ReadingMonthCharmOption[] = [
  { id: 'book-stack', label: 'Book Stack', emoji: '📚', category: 'reading' },
  { id: 'open-book', label: 'Open Book', emoji: '📖', category: 'reading' },
  { id: 'bookmark', label: 'Bookmark', emoji: '🔖', category: 'reading' },
  { id: 'glasses', label: 'Glasses', emoji: '👓', category: 'reading' },
  { id: 'headphones', label: 'Headphones', emoji: '🎧', category: 'reading' },
  { id: 'pen', label: 'Pen', emoji: '🖊️', category: 'reading' },
  { id: 'notebook', label: 'Notebook', emoji: '📓', category: 'reading' },
  { id: 'library', label: 'Library', emoji: '🏛️', category: 'reading' },

  { id: 'mug', label: 'Coffee', emoji: '☕', category: 'cozy' },
  { id: 'tea', label: 'Tea', emoji: '🫖', category: 'cozy' },
  { id: 'candle', label: 'Candle', emoji: '🕯️', category: 'cozy' },
  { id: 'scarf', label: 'Scarf', emoji: '🧣', category: 'cozy' },
  { id: 'fire', label: 'Fire', emoji: '🔥', category: 'cozy' },
  { id: 'cookie', label: 'Cookie', emoji: '🍪', category: 'cozy' },
  { id: 'chocolate', label: 'Chocolate', emoji: '🍫', category: 'cozy' },
  { id: 'croissant', label: 'Croissant', emoji: '🥐', category: 'cozy' },

  { id: 'plant', label: 'Plant', emoji: '🪴', category: 'nature' },
  { id: 'sun', label: 'Sun', emoji: '☀️', category: 'nature' },
  { id: 'moon', label: 'Moon', emoji: '🌙', category: 'nature' },
  { id: 'flower', label: 'Flower', emoji: '🌸', category: 'nature' },
  { id: 'leaves', label: 'Leaves', emoji: '🍂', category: 'nature' },
  { id: 'mushroom', label: 'Mushroom', emoji: '🍄', category: 'nature' },
  { id: 'rain', label: 'Rain', emoji: '🌧️', category: 'nature' },
  { id: 'butterfly', label: 'Butterfly', emoji: '🦋', category: 'nature' },

  { id: 'cat', label: 'Cat', emoji: '🐈', category: 'cute' },
  { id: 'dog', label: 'Dog', emoji: '🐕', category: 'cute' },
  { id: 'paw', label: 'Paw', emoji: '🐾', category: 'cute' },
  { id: 'frog', label: 'Frog', emoji: '🐸', category: 'cute' },
  { id: 'teddy', label: 'Teddy', emoji: '🧸', category: 'cute' },
  { id: 'heart', label: 'Heart', emoji: '💖', category: 'cute' },
  { id: 'bee', label: 'Bee', emoji: '🐝', category: 'cute' },
  { id: 'snail', label: 'Snail', emoji: '🐌', category: 'cute' },

  { id: 'pumpkin', label: 'Pumpkin', emoji: '🎃', category: 'halloween' },
  { id: 'ghost', label: 'Ghost', emoji: '👻', category: 'halloween' },
  { id: 'bat', label: 'Bat', emoji: '🦇', category: 'halloween' },
  { id: 'skull', label: 'Skull', emoji: '💀', category: 'halloween' },
  { id: 'spider', label: 'Spider', emoji: '🕷️', category: 'halloween' },
  { id: 'web', label: 'Web', emoji: '🕸️', category: 'halloween' },
  { id: 'candy', label: 'Candy', emoji: '🍬', category: 'halloween' },
  { id: 'black-cat', label: 'Black Cat', emoji: '🐈‍⬛', category: 'halloween' },

  { id: 'christmas-tree', label: 'Tree', emoji: '🎄', category: 'christmas' },
  { id: 'gift', label: 'Gift', emoji: '🎁', category: 'christmas' },
  { id: 'santa', label: 'Santa', emoji: '🎅', category: 'christmas' },
  { id: 'snowman', label: 'Snowman', emoji: '☃️', category: 'christmas' },
  { id: 'bell', label: 'Bell', emoji: '🔔', category: 'christmas' },
  { id: 'stocking', label: 'Stocking', emoji: '🧦', category: 'christmas' },
  { id: 'gingerbread', label: 'Gingerbread', emoji: '🍪', category: 'christmas' },
  { id: 'snowflake', label: 'Snowflake', emoji: '❄️', category: 'christmas' },

  { id: 'sunglasses', label: 'Sunglasses', emoji: '😎', category: 'summer' },
  { id: 'watermelon', label: 'Watermelon', emoji: '🍉', category: 'summer' },
  { id: 'ice-cream', label: 'Ice Cream', emoji: '🍦', category: 'summer' },
  { id: 'beach', label: 'Beach', emoji: '🏖️', category: 'summer' },
  { id: 'wave', label: 'Wave', emoji: '🌊', category: 'summer' },
  { id: 'shell', label: 'Shell', emoji: '🐚', category: 'summer' },
  { id: 'palm', label: 'Palm', emoji: '🌴', category: 'summer' },
  { id: 'sun-face', label: 'Sunshine', emoji: '🌞', category: 'summer' },

  { id: 'fireworks', label: 'Fireworks', emoji: '🎆', category: 'celebrations' },
  { id: 'sparkler', label: 'Sparkler', emoji: '🎇', category: 'celebrations' },
  { id: 'usa-flag', label: 'USA', emoji: '🇺🇸', category: 'celebrations' },
  { id: 'balloon', label: 'Balloon', emoji: '🎈', category: 'celebrations' },
  { id: 'confetti', label: 'Confetti', emoji: '🎉', category: 'celebrations' },
  { id: 'cake', label: 'Cake', emoji: '🎂', category: 'celebrations' },
  { id: 'star', label: 'Star', emoji: '⭐', category: 'celebrations' },
  { id: 'ribbon', label: 'Ribbon', emoji: '🎀', category: 'celebrations' },

  { id: 'globe', label: 'Globe', emoji: '🌎', category: 'nature' },
];

export const VALID_READING_MONTH_CHARMS =
  new Set<ReadingMonthCharm>(
    READING_MONTH_CHARM_OPTIONS.map(
      (
        option
      ) =>
        option.id
    )
  );

export function getReadingMonthCharmOption(
  charm:
    ReadingMonthCharm
) {
  return READING_MONTH_CHARM_OPTIONS.find(
    (
      option
    ) =>
      option.id ===
      charm
  );
}

export function getDefaultReadingMonthCharmCategory(
  monthIndex:
    number
): ReadingMonthCharmCategory {
  if (
    monthIndex ===
    9
  ) {
    return 'halloween';
  }

  if (
    monthIndex ===
    11
  ) {
    return 'christmas';
  }

  if (
    monthIndex ===
    6
  ) {
    return 'celebrations';
  }

  if (
    monthIndex >=
      5 &&
    monthIndex <=
      7
  ) {
    return 'summer';
  }

  return 'reading';
}
