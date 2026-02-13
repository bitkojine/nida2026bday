function escapeHtml(source: string): string {
  return source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const TOKEN_REGEX =
  /(\/\/.*$)|("(?:\\.|[^"\\])*")|\b(public|class|interface|bool|int|float|string|return|if|else|true|false|new)\b|\b([0-9]+(?:\.[0-9]+)?f?)\b/gm;

export function highlightCSharp(source: string): string {
  const escaped = escapeHtml(source);
  return escaped.replace(TOKEN_REGEX, (match, comment, str, keyword, number) => {
    if (comment) {
      return `<span class="tok-comment">${match}</span>`;
    }
    if (str) {
      return `<span class="tok-string">${match}</span>`;
    }
    if (keyword) {
      return `<span class="tok-keyword">${match}</span>`;
    }
    if (number) {
      return `<span class="tok-number">${match}</span>`;
    }
    return match;
  });
}
