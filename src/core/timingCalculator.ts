import type { DanceRules, Judgement } from './types';

export function sanitizeWindows(rules: DanceRules): DanceRules {
  const perfect = Math.max(0.01, rules.tobulasLangas);
  const good = Math.max(perfect, rules.gerasLangas);

  return {
    ...rules,
    tobulasLangas: perfect,
    gerasLangas: good,
  };
}

export function calculateJudgement(offsetSec: number, rules: DanceRules): Judgement {
  const safeRules = sanitizeWindows(rules);
  const absOffset = Math.abs(offsetSec);

  if (absOffset <= safeRules.tobulasLangas) {
    return 'TOBULA';
  }

  if (absOffset <= safeRules.gerasLangas) {
    return 'GERAI';
  }

  return 'PRALEISTA';
}
