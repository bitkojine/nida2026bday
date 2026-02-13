import { describe, expect, it } from 'vitest';
import { highlightCSharp } from '../src/ui/fallbackSyntaxHighlighter';

describe('fallbackSyntaxHighlighter', () => {
  it('highlights keywords, strings, numbers and comments', () => {
    const source = 'public int x = 10; // test\npublic string s = "labas";';
    const html = highlightCSharp(source);

    expect(html).toContain('<span class="tok-keyword">public</span>');
    expect(html).toContain('<span class="tok-number">10</span>');
    expect(html).toContain('<span class="tok-comment">// test</span>');
    expect(html).toContain('<span class="tok-string">"labas"</span>');
  });

  it('escapes html input safely', () => {
    const html = highlightCSharp('public string s = "<script>";');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
