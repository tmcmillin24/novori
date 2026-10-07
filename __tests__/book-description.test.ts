import { describe, expect, test } from '@jest/globals';
import { formatBookDescription } from '../src/lib/book-description';

describe('book description display', () => {
  test.each([
    ['You know what&rsquo;s worse&hellip;', 'You know what’s worse…'],
    ['&ldquo;Hello&rdquo; &mdash; caf&eacute; &amp; friends', '“Hello” — café & friends'],
    ['It&#8217;s &#x201C;great&#x201D; &#128218;', 'It’s “great” 📚'],
    ['You know what&amp;rsquo;s worse', 'You know what’s worse'],
    ['&amp;amp;ldquo;Hello&amp;amp;rdquo;', '“Hello”'],
    ['<p class="intro">First <b>paragraph</b>.</p><p>Second<br />line.</p>', 'First paragraph.\n\nSecond\nline.'],
    ['&lt;p&gt;Escaped markup&lt;/p&gt;', 'Escaped markup'],
    ['Already readable — don’t change it. 📚', 'Already readable — don’t change it. 📚'],
    ['A & B; 2 < 3 and 5 > 4', 'A & B; 2 < 3 and 5 > 4'],
    ['  A&nbsp;  book\r\n\r\n\r\nNext\t paragraph  ', 'A book\n\nNext paragraph'],
    ['<style>hidden</style><script>hidden()</script><!-- comment --><p>Visible</p>', 'Visible'],
    ['Unknown &notARealEntity; stays intact', 'Unknown &notARealEntity; stays intact'],
    ['<p><b></b>&nbsp;</p>', ''],
  ])('formats %s', (input, output) => {
    expect(formatBookDescription(input)).toBe(output);
  });

  test('list items remain separate and links retain readable labels', () => {
    const result = formatBookDescription('<ul><li>One</li><li><a href="https://example.com">Two</a></li></ul>');
    expect(result).toBe('• One\n• Two');
  });

  test('missing descriptions use the existing empty-description fallback', () => {
    expect(formatBookDescription()).toBe('');
    expect(formatBookDescription(null)).toBe('');
  });

  test('formatting a cached description leaves metadata and cover references intact', () => {
    const book = Object.freeze({
      id: 'cached-book',
      volumeInfo: Object.freeze({ description: 'What&rsquo;s next?', imageLinks: Object.freeze({ thumbnail: 'https://covers.example/high-res.jpg' }) }),
    });
    const original = JSON.stringify(book);
    expect(formatBookDescription(book.volumeInfo.description)).toBe('What’s next?');
    expect(JSON.stringify(book)).toBe(original);
  });
});
