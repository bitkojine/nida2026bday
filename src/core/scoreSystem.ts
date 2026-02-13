import type { DanceRules, Judgement, ScoreState } from './types';

export function scoreForJudgement(judgement: Judgement, rules: DanceRules): number {
  if (judgement === 'TOBULA') {
    return Math.max(0, rules.tobuliTaskai);
  }

  if (judgement === 'GERAI') {
    return Math.max(0, rules.geriTaskai);
  }

  return 0;
}

export function applyJudgement(
  judgement: Judgement,
  state: ScoreState,
  rules: DanceRules,
): ScoreState {
  const streak = judgement === 'PRALEISTA' ? 0 : state.streak + 1;
  const hypeActive = streak >= Math.max(1, rules.serijaIkiHype);
  const base = scoreForJudgement(judgement, rules);
  const added = hypeActive ? base * 2 : base;

  return {
    score: state.score + added,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    hypeActive,
    lastJudgement: judgement,
  };
}
