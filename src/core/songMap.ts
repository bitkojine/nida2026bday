export interface ChartStep {
  lane: number;
  spacingBeats?: number;
  holdBeats?: number;
  toneHz?: number;
}

// "Happy Birthday" chart with matching rhythm and guide-note pitches.
// Long phrase-ending notes are represented as holds.
export const DEFAULT_SONG_MAP: ChartStep[] = [
  { lane: 1, toneHz: 392.0, spacingBeats: 1, holdBeats: 0 }, // G
  { lane: 1, toneHz: 392.0, spacingBeats: 1, holdBeats: 0 }, // G
  { lane: 2, toneHz: 440.0, spacingBeats: 2, holdBeats: 0.9 }, // A
  { lane: 1, toneHz: 392.0, spacingBeats: 2, holdBeats: 0 }, // G
  { lane: 3, toneHz: 523.25, spacingBeats: 2, holdBeats: 0 }, // C
  { lane: 2, toneHz: 493.88, spacingBeats: 4, holdBeats: 2.8 }, // B

  { lane: 1, toneHz: 392.0, spacingBeats: 1, holdBeats: 0 }, // G
  { lane: 1, toneHz: 392.0, spacingBeats: 1, holdBeats: 0 }, // G
  { lane: 2, toneHz: 440.0, spacingBeats: 2, holdBeats: 0.9 }, // A
  { lane: 1, toneHz: 392.0, spacingBeats: 2, holdBeats: 0 }, // G
  { lane: 0, toneHz: 587.33, spacingBeats: 2, holdBeats: 0 }, // D
  { lane: 3, toneHz: 523.25, spacingBeats: 4, holdBeats: 2.8 }, // C

  { lane: 1, toneHz: 392.0, spacingBeats: 1, holdBeats: 0 }, // G
  { lane: 1, toneHz: 392.0, spacingBeats: 1, holdBeats: 0 }, // G
  { lane: 0, toneHz: 783.99, spacingBeats: 2, holdBeats: 0.8 }, // G5
  { lane: 2, toneHz: 659.25, spacingBeats: 2, holdBeats: 0 }, // E
  { lane: 3, toneHz: 523.25, spacingBeats: 2, holdBeats: 0 }, // C
  { lane: 2, toneHz: 493.88, spacingBeats: 2, holdBeats: 0 }, // B
  { lane: 1, toneHz: 440.0, spacingBeats: 4, holdBeats: 2.4 }, // A

  { lane: 0, toneHz: 698.46, spacingBeats: 1, holdBeats: 0 }, // F
  { lane: 0, toneHz: 698.46, spacingBeats: 1, holdBeats: 0 }, // F
  { lane: 2, toneHz: 659.25, spacingBeats: 2, holdBeats: 0 }, // E
  { lane: 3, toneHz: 523.25, spacingBeats: 2, holdBeats: 0 }, // C
  { lane: 0, toneHz: 587.33, spacingBeats: 2, holdBeats: 0 }, // D
  { lane: 3, toneHz: 523.25, spacingBeats: 4, holdBeats: 3.2 }, // C
];
