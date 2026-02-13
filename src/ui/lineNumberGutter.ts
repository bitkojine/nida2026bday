function visualLength(line: string): number {
  // Match textarea tab-size: 2 behavior in wrap estimation.
  return line.replace(/\t/g, '  ').length;
}

export function buildWrappedLineNumbers(source: string, charsPerVisualLine: number): string {
  const safeCharsPerLine = Math.max(1, Math.floor(charsPerVisualLine));
  const sourceLines = source.split('\n');
  const rows: string[] = [];

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i] ?? '';
    const wraps = Math.max(1, Math.ceil(Math.max(1, visualLength(line)) / safeCharsPerLine));
    rows.push(`${i + 1}`);
    for (let wrap = 1; wrap < wraps; wrap += 1) {
      rows.push('↳');
    }
  }

  return rows.join('\n');
}
