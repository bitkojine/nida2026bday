import { applyJudgement } from './scoreSystem';
import type { DanceRules, Judgement, ScoreState } from './types';
import { INITIAL_SCORE_STATE } from './types';

export type SessionState = {
  screen: 'splash' | 'start' | 'play';
  score: ScoreState;
};

export class GameStateManager {
  private state: SessionState = {
    screen: 'splash',
    score: INITIAL_SCORE_STATE,
  };

  getState(): SessionState {
    return this.state;
  }

  goTo(screen: SessionState['screen']): void {
    this.state = {
      ...this.state,
      screen,
    };
  }

  resetRun(): void {
    this.state = {
      ...this.state,
      score: INITIAL_SCORE_STATE,
    };
  }

  apply(judgement: Judgement, rules: DanceRules): ScoreState {
    const next = applyJudgement(judgement, this.state.score, rules);
    this.state = {
      ...this.state,
      score: next,
    };

    return next;
  }
}
