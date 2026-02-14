export type Judgement = 'TOBULA' | 'GERAI' | 'PRALEISTA';

export type HorseMood = Judgement | 'UZSIVEDIMAS';
export type HorseWeather = 'SAULETA' | 'LIETINGA' | 'SNIEGAS' | 'ZAIBAS';
export type HorseHat = 'KLASIKINE' | 'KAUBOJAUS' | 'KARUNA' | 'RAGANOS';

export interface DanceRules {
  tobulasLangas: number;
  gerasLangas: number;
  tobuliTaskai: number;
  geriTaskai: number;
  serijaIkiHype: number;
  arklioSpalva: string;
  karciuSpalva: string;
  suKepure: boolean;
  kepuresTipas: HorseHat;
  oroEfektas: HorseWeather;
}

export interface ScoreState {
  score: number;
  streak: number;
  bestStreak: number;
  hypeActive: boolean;
  lastJudgement: Judgement;
}

export type GameScreen = 'splash' | 'start' | 'play';

export interface CompileResult {
  success: boolean;
  rules: DanceRules;
  errors: string[];
  mode: 'wasm' | 'fallback';
}

export const DEFAULT_RULES: DanceRules = {
  tobulasLangas: 0.05,
  gerasLangas: 0.12,
  tobuliTaskai: 100,
  geriTaskai: 50,
  serijaIkiHype: 10,
  arklioSpalva: '#d6b48a',
  karciuSpalva: '#7d4f2d',
  suKepure: false,
  kepuresTipas: 'KLASIKINE',
  oroEfektas: 'SAULETA',
};

export const INITIAL_SCORE_STATE: ScoreState = {
  score: 0,
  streak: 0,
  bestStreak: 0,
  hypeActive: false,
  lastJudgement: 'PRALEISTA',
};
