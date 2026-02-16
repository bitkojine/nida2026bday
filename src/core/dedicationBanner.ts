import type { GameScreen } from './types';

export const DEDICATION_TEXT = 'Skirta Nidai – nuo Roberto. Su gimtadieniu! 🎉';

export function shouldShowDedication(screen: GameScreen): boolean {
  return screen === 'play';
}
