import './style.css';
import { DEDICATION_TEXT } from './core/dedicationBanner';
import { GameStateManager } from './core/gameStateManager';
import { normalizeLaneFromKey } from './core/inputController';
import { buildLayoutMetrics } from './core/layoutManager';
import { computeNoteYPercent } from './core/noteLayout';
import { RhythmEngine } from './core/rhythmEngine';
import { DEFAULT_RULES, type DanceRules, type HorseMood } from './core/types';
import { HorseAnimator } from './render/horseAnimator';
import { CodeCompilerService } from './services/codeCompilerService';
import { CSHARP_TEMPLATE } from './services/csharpTemplate';
import { applyCompileResult, wireFallbackCompiler } from './ui/compileFeedback';
import { mountMonacoEditor } from './ui/monacoEditor';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App element not found');
}

function requiredElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Missing element: ${selector}`);
  }

  return el;
}

app.innerHTML = `
  <main class="layout">
    <section class="game" id="gameScreen">
      <h1>Sokanti Arklio Ritmo Dovana</h1>
      <header class="hud">
        <div><strong>Taskai</strong><span id="score">0</span></div>
        <div><strong>Combo</strong><span id="streak">0</span></div>
        <div><strong>Daugiklis</strong><span id="multiplier">x1</span></div>
        <div><strong>Vertinimas</strong><span id="judgement">PRALEISTA</span></div>
        <button class="autoplay-toggle" id="autoplayToggle" type="button">Žaisti automatiškai: TAIP</button>
      </header>

      <canvas id="horseCanvas" aria-label="Sokantis arklys"></canvas>

      <section class="highway-shell" aria-label="Ritmo juostos">
        <div class="highway" id="laneHighway" aria-hidden="true"></div>
        <div class="hit-line"></div>
        <div class="judgement-pop" id="judgementPop">PRALEISTA</div>
      </section>

      <div class="input-row" id="inputRow">
        <button data-lane="0" aria-label="Kaire"><span>←</span></button>
        <button data-lane="1" aria-label="Zemyn"><span>↓</span></button>
        <button data-lane="2" aria-label="Aukstyn"><span>↑</span></button>
        <button data-lane="3" aria-label="Desinen"><span>→</span></button>
      </div>

      <details class="code-studio">
        <summary>C# studija: keisk žaidimo taisykles</summary>
        <section class="editor-panel">
          <div class="editor-header">
            <h2>Tavo C# taisykles</h2>
            <span id="compileStatus">Kompiliuojama...</span>
          </div>
          <div id="editor" class="editor"></div>
        </section>
      </details>
      <p class="dedication dedication-footer">${DEDICATION_TEXT} 🎉</p>
    </section>
  </main>
`;

const gameScreen = requiredElement<HTMLElement>('#gameScreen');
const scoreEl = requiredElement<HTMLElement>('#score');
const streakEl = requiredElement<HTMLElement>('#streak');
const multiplierEl = requiredElement<HTMLElement>('#multiplier');
const judgementEl = requiredElement<HTMLElement>('#judgement');
const judgementPopEl = requiredElement<HTMLElement>('#judgementPop');
const autoplayToggleEl = requiredElement<HTMLButtonElement>('#autoplayToggle');
const compileStatusEl = requiredElement<HTMLElement>('#compileStatus');
const laneHighwayEl = requiredElement<HTMLElement>('#laneHighway');
const canvas = requiredElement<HTMLCanvasElement>('#horseCanvas');
const editorHost = requiredElement<HTMLDivElement>('#editor');

const state = new GameStateManager();
const engine = new RhythmEngine(92, performance.now() / 1000, [0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 1, 1]);
const compiler = new CodeCompilerService();

let rules: DanceRules = DEFAULT_RULES;
let mood: HorseMood = 'GERAI';
let compileTimer: number | null = null;
let autoplayEnabled = true;
const autoPlayedBeatIds = new Set<number>();

const ctxOrNull = canvas.getContext('2d');
if (!ctxOrNull) {
  throw new Error('Canvas context unavailable');
}
const ctx: CanvasRenderingContext2D = ctxOrNull;

const horseAnimator = new HorseAnimator(ctx);

function updateHud(score: number, streak: number, judgement: string): void {
  scoreEl.textContent = `${score}`;
  streakEl.textContent = `${streak}`;
  multiplierEl.textContent = `x${getMultiplier(streak)}`;
  judgementEl.textContent = judgement;
}

function renderLanes(nowSec: number): void {
  const leadSec = 2;
  const trailSec = 0.25;
  const notes = engine.getBeatsInRange(nowSec - trailSec, nowSec + leadSec);

  laneHighwayEl.innerHTML = notes
    .map((note) => {
      const delta = note.timeSec - nowSec;
      const y = computeNoteYPercent(delta, leadSec, trailSec);
      const raw = 1 - Math.max(0, delta) / leadSec;
      const eased = Math.pow(Math.min(1, Math.max(0, raw)), 1.2);
      const scale = 0.64 + eased * 0.72;
      const opacity = 0.32 + eased * 0.68;
      return `<div class="note note-lane-${note.lane}" style="top:${y}%; transform: translate(-50%, -50%) scale(${scale}); opacity:${opacity}"></div>`;
    })
    .join('');
}

function getMultiplier(streak: number): number {
  if (streak >= 30) {
    return 4;
  }
  if (streak >= 20) {
    return 3;
  }
  if (streak >= 10) {
    return 2;
  }
  return 1;
}

function showJudgementFeedback(
  judgement: 'TOBULA' | 'GERAI' | 'PRALEISTA',
  lane: number | null,
): void {
  judgementPopEl.textContent = judgement;
  judgementPopEl.classList.remove('show', 'tobula', 'gerai', 'praleista');
  if (judgement === 'TOBULA') {
    judgementPopEl.classList.add('tobula');
  } else if (judgement === 'GERAI') {
    judgementPopEl.classList.add('gerai');
  } else {
    judgementPopEl.classList.add('praleista');
  }
  judgementPopEl.classList.add('show');
  window.setTimeout(() => {
    judgementPopEl.classList.remove('show');
  }, 180);

  if (lane !== null) {
    const laneButton = document.querySelector<HTMLButtonElement>(
      `.input-row button[data-lane="${lane}"]`,
    );
    if (laneButton) {
      laneButton.classList.add('hit');
      window.setTimeout(() => laneButton.classList.remove('hit'), 120);
    }
  }
}

function resizeCanvas(): void {
  const cardStyle = window.getComputedStyle(gameScreen);
  const horizontalPadding =
    Number.parseFloat(cardStyle.paddingLeft) + Number.parseFloat(cardStyle.paddingRight);
  const containerWidth = Math.floor(gameScreen.clientWidth - horizontalPadding);
  const fallbackWidth = Math.floor(window.innerWidth - 24);
  const availableWidth = containerWidth > 0 ? containerWidth : fallbackWidth;
  const horseWidth = Math.max(220, availableWidth);
  const horseHeight = Math.min(170, Math.max(120, Math.floor(window.innerHeight * 0.2)));
  const metrics = buildLayoutMetrics(horseWidth, horseHeight, window.devicePixelRatio || 1);
  canvas.style.width = `${metrics.width}px`;
  canvas.style.height = `${metrics.height}px`;
  canvas.width = metrics.canvasWidth;
  canvas.height = metrics.canvasHeight;
  ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas, { passive: true });

function applyHit(hitTimeSec: number, lane: number | null): void {
  const judgement =
    lane === null
      ? engine.registerHit(hitTimeSec, rules)
      : engine.registerLaneHit(hitTimeSec, rules, lane);
  const next = state.apply(judgement, rules);

  if (next.hypeActive) {
    mood = 'UZSIVEDIMAS';
  } else if (judgement === 'TOBULA') {
    mood = 'TOBULA';
  } else if (judgement === 'GERAI') {
    mood = 'GERAI';
  } else {
    mood = 'PRALEISTA';
  }

  scoreEl.textContent = `${next.score}`;
  updateHud(next.score, next.streak, mood === 'UZSIVEDIMAS' ? 'UZSIVEDIMAS' : judgement);
  showJudgementFeedback(judgement, lane);
}

function startLoop(): void {
  const tick = (timeMs: number): void => {
    const now = timeMs / 1000;
    engine.update(now);
    if (autoplayEnabled) {
      const autoWindowSec = Math.max(0.01, rules.tobulasLangas * 0.75);
      const notesToPlay = engine.getBeatsInRange(now - autoWindowSec, now + autoWindowSec);
      for (const note of notesToPlay) {
        if (autoPlayedBeatIds.has(note.id)) {
          continue;
        }
        autoPlayedBeatIds.add(note.id);
        applyHit(note.timeSec, note.lane);
      }
    }
    const missed = engine.consumeMissed(now, rules.gerasLangas + 0.08);
    for (let i = 0; i < missed; i += 1) {
      const next = state.apply('PRALEISTA', rules);
      mood = 'PRALEISTA';
      updateHud(next.score, next.streak, 'PRALEISTA');
      showJudgementFeedback('PRALEISTA', null);
    }
    renderLanes(now);
    horseAnimator.render(timeMs, mood, rules);
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

async function initEditor(): Promise<void> {
  try {
    const editor = await mountMonacoEditor(editorHost, CSHARP_TEMPLATE);

    const runCompile = (): void => {
      applyCompileResult(editor.getValue(), compiler, {
        setRules: (next) => {
          rules = next;
        },
        setStatus: (next) => {
          compileStatusEl.textContent = next;
        },
      });
    };

    editor.onDidChangeModelContent(() => {
      if (compileTimer !== null) {
        window.clearTimeout(compileTimer);
      }
      compileTimer = window.setTimeout(runCompile, 150);
    });

    runCompile();
  } catch {
    editorHost.innerHTML = '<textarea class="fallback-editor" id="fallbackCode"></textarea>';
    const fallback = document.querySelector<HTMLTextAreaElement>('#fallbackCode');
    if (!fallback) {
      return;
    }

    wireFallbackCompiler(fallback, CSHARP_TEMPLATE, compiler, {
      setRules: (next) => {
        rules = next;
      },
      setStatus: (next) => {
        compileStatusEl.textContent = next;
      },
    });
  }
}

function wireInputs(): void {
  document.querySelectorAll<HTMLButtonElement>('.input-row button').forEach((button) => {
    const lane = Number(button.dataset.lane);
    button.addEventListener(
      'touchstart',
      (event) => {
        event.preventDefault();
        applyHit(performance.now() / 1000, lane);
      },
      { passive: false },
    );

    button.addEventListener('click', () => {
      applyHit(performance.now() / 1000, lane);
    });
  });

  window.addEventListener('keydown', (event) => {
    const lane = normalizeLaneFromKey(event.key);
    if (lane === null) {
      return;
    }

    event.preventDefault();
    applyHit(performance.now() / 1000, lane);
  });
}

requestAnimationFrame(resizeCanvas);
state.goTo('play');
state.resetRun();

autoplayToggleEl.addEventListener('click', () => {
  autoplayEnabled = !autoplayEnabled;
  autoplayToggleEl.textContent = `Žaisti automatiškai: ${autoplayEnabled ? 'TAIP' : 'NE'}`;
});

declare global {
  interface Window {
    __rhythmTest?: {
      setAutoplay(enabled: boolean): void;
      resetScore(): void;
      playNearest(lane: number, offsetSec: number): boolean;
      playNearestAny(offsetSec: number): boolean;
      read(): {
        score: number;
        streak: number;
        judgement: string;
      };
      getRules(): DanceRules;
    };
  }
}

window.__rhythmTest = {
  setAutoplay(enabled: boolean): void {
    autoplayEnabled = enabled;
    autoplayToggleEl.textContent = `Žaisti automatiškai: ${autoplayEnabled ? 'TAIP' : 'NE'}`;
  },
  resetScore(): void {
    state.resetRun();
    autoPlayedBeatIds.clear();
    const current = state.getState().score;
    updateHud(current.score, current.streak, 'PRALEISTA');
  },
  playNearest(lane: number, offsetSec: number): boolean {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, 3).find((candidate) => candidate.lane === lane);
    if (!note) {
      return false;
    }

    applyHit(note.timeSec + offsetSec, lane);
    return true;
  },
  playNearestAny(offsetSec: number): boolean {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, 3)[0];
    if (!note) {
      return false;
    }

    applyHit(note.timeSec + offsetSec, note.lane);
    return true;
  },
  read(): { score: number; streak: number; judgement: string } {
    return {
      score: Number(scoreEl.textContent ?? '0'),
      streak: Number(streakEl.textContent ?? '0'),
      judgement: judgementEl.textContent ?? 'PRALEISTA',
    };
  },
  getRules(): DanceRules {
    return rules;
  },
};

void compiler.init();
void initEditor();
wireInputs();
startLoop();
