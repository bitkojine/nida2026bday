import './style.css';
import { GameAudio } from './audio/gameAudio';
import { DEDICATION_TEXT } from './core/dedicationBanner';
import { GameStateManager } from './core/gameStateManager';
import { normalizeLaneFromKey } from './core/inputController';
import { buildLayoutMetrics } from './core/layoutManager';
import { computeNoteYPercent } from './core/noteLayout';
import type { HitEvaluation } from './core/rhythmEngine';
import { RhythmEngine } from './core/rhythmEngine';
import { DEFAULT_SONG_MAP } from './core/songMap';
import { DEFAULT_RULES, type DanceRules, type HorseMood, type Judgement } from './core/types';
import { HorseAnimator } from './render/horseAnimator';
import { CodeCompilerService } from './services/codeCompilerService';
import { CSHARP_TEMPLATE } from './services/csharpTemplate';
import { applyCompileResult, wireFallbackCompiler } from './ui/compileFeedback';
import { highlightCSharp } from './ui/fallbackSyntaxHighlighter';
import { buildWrappedLineNumbers } from './ui/lineNumberGutter';
import { mountMonacoEditor } from './ui/monacoEditor';

declare const __BUILD_VILNIUS_TIME__: string;

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
      <h1>🎁 Šokanti Arklio Ritmo Dovana</h1>
      <header class="hud">
        <div><strong>Taškai</strong><span id="score">0</span></div>
        <div><strong>Serija</strong><span id="streak">0</span></div>
        <div><strong>Daugiklis</strong><span id="multiplier">x1</span></div>
        <div><strong>Vertinimas</strong><span id="judgement">PRALEISTA</span></div>
        <button class="autoplay-toggle" id="autoplayToggle" type="button">Žaisti automatiškai: TAIP</button>
      </header>

      <canvas id="horseCanvas" aria-label="Šokantis arklys"></canvas>

      <section class="highway-shell" aria-label="Ritmo juostos">
        <div class="highway" id="laneHighway" aria-hidden="true"></div>
        <div class="hit-line"></div>
        <div class="judgement-pop" id="judgementPop">PRALEISTA</div>
      </section>

      <div class="input-row" id="inputRow">
        <button data-lane="0" aria-label="Kairė"><span>←</span></button>
        <button data-lane="1" aria-label="Žemyn"><span>↓</span></button>
        <button data-lane="2" aria-label="Aukštyn"><span>↑</span></button>
        <button data-lane="3" aria-label="Dešinė"><span>→</span></button>
      </div>

      <details class="code-studio">
        <summary>
          <span>C# studija: keisk žaidimo taisykles</span>
          <span class="compile-status-wrap">
            <span id="compileStatus">Kompiliuojama...</span>
            <button
              id="compileHelpToggle"
              class="help-btn"
              type="button"
              aria-label="Kas tai?"
              title="Kas tai?"
            >
              ?
            </button>
          </span>
        </summary>
        <section id="compileHelpPanel" class="compile-help" hidden>
          <h3>Ką reiškia kompiliavimo būsena?</h3>
          <p><strong>Paruošta (.NET WASM)</strong> reiškia, kad C# kodas veikia per .NET WebAssembly naršyklėje.</p>
          <p><strong>Paruošta (Suderinamas režimas)</strong> reiškia, kad naršyklė nepalaikė pilno .NET vykdymo, todėl naudojamas atsarginis vietinis taisyklių vertinimas.</p>
          <p>Abiem atvejais žaidimas veikia ir tavo pakeitimai taikomi iš karto. Jei matai klaidą:</p>
          <ol>
            <li>Patikrink, ar neužmiršai kabliataškio <code>;</code>.</li>
            <li>Patikrink, ar visi skliaustai <code>{ }</code> uždaryti poromis.</li>
            <li>Redaguok tik pažymėtą „GALI KEISTI“ sritį.</li>
            <li>Po pakeitimo palauk trumpai (apie 0.1–0.2 s), kol būsena atsinaujins į „Paruošta“.</li>
          </ol>
        </section>
        <section class="editor-panel">
          <div id="editor" class="editor"></div>
        </section>
      </details>
      <p class="dedication dedication-footer">${DEDICATION_TEXT} 🎉</p>
      <p class="build-number">Versija: ${__BUILD_VILNIUS_TIME__} (Vilnius)</p>
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
const compileHelpToggleEl = requiredElement<HTMLButtonElement>('#compileHelpToggle');
const compileHelpPanelEl = requiredElement<HTMLElement>('#compileHelpPanel');
const laneHighwayEl = requiredElement<HTMLElement>('#laneHighway');
const canvas = requiredElement<HTMLCanvasElement>('#horseCanvas');
const editorHost = requiredElement<HTMLDivElement>('#editor');

const state = new GameStateManager();
const engine = new RhythmEngine(92, performance.now() / 1000, DEFAULT_SONG_MAP);
const compiler = new CodeCompilerService();
const audio = new GameAudio();
const HYPE_LABEL = 'UŽSIVEDĘS';

let rules: DanceRules = DEFAULT_RULES;
let mood: HorseMood = 'GERAI';
let compileTimer: number | null = null;
let autoplayEnabled = true;
const autoPlayedBeatIds = new Set<number>();
const songPlayedBeatIds = new Set<number>();
const autoHeldLanes = new Set<number>();
const pressedLanes = new Set<number>();

interface ActiveHold {
  lane: number;
  startSec: number;
  endSec: number;
  baseJudgement: 'TOBULA' | 'GERAI';
}

const activeHolds = new Map<number, ActiveHold>();

const ctxOrNull = canvas.getContext('2d');
if (!ctxOrNull) {
  throw new Error('Canvas context unavailable');
}
const ctx: CanvasRenderingContext2D = ctxOrNull;

const horseAnimator = new HorseAnimator(ctx);

function wireAudioBootstrap(): void {
  const tryUnlock = (): void => {
    audio.unlock();
  };

  // Best-effort attempt on initial load.
  tryUnlock();

  // Retry while autoplay is active; if browser policy allows, audio starts
  // without waiting for explicit gameplay input.
  window.setInterval(() => {
    if (!autoplayEnabled) {
      return;
    }
    if (audio.isUnlocked()) {
      return;
    }
    tryUnlock();
  }, 900);

  // Policy-safe recovery hooks for browsers that require any user gesture.
  window.addEventListener('pointerdown', tryUnlock, { passive: true });
  window.addEventListener('keydown', tryUnlock);
  window.addEventListener('touchstart', tryUnlock, { passive: true });
  window.addEventListener('mousedown', tryUnlock);
  window.addEventListener('wheel', tryUnlock, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tryUnlock();
    }
  });
}

function wireCompileHelp(): void {
  const closeHelp = (): void => {
    compileHelpPanelEl.hidden = true;
    compileHelpToggleEl.setAttribute('aria-expanded', 'false');
  };

  const openHelp = (): void => {
    compileHelpPanelEl.hidden = false;
    compileHelpToggleEl.setAttribute('aria-expanded', 'true');
  };

  compileHelpToggleEl.setAttribute('aria-expanded', 'false');
  compileHelpToggleEl.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (compileHelpPanelEl.hidden) {
      openHelp();
    } else {
      closeHelp();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (compileHelpPanelEl.hidden) {
      return;
    }

    if (compileHelpPanelEl.contains(target) || compileHelpToggleEl.contains(target)) {
      return;
    }

    closeHelp();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHelp();
    }
  });
}

function shouldUseSimpleEditor(): boolean {
  const touchLike = window.matchMedia('(pointer: coarse)').matches;
  const narrowScreen = window.innerWidth <= 900;
  return touchLike || narrowScreen;
}

function mountSimpleEditor(): void {
  editorHost.innerHTML =
    '<div class="syntax-editor"><pre class="fallback-lines" id="fallbackLines" aria-hidden="true"></pre><pre class="fallback-highlight" id="fallbackHighlight" aria-hidden="true"></pre><textarea class="fallback-editor" id="fallbackCode" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"></textarea></div>';
  const fallback = document.querySelector<HTMLTextAreaElement>('#fallbackCode');
  const lines = document.querySelector<HTMLPreElement>('#fallbackLines');
  const highlight = document.querySelector<HTMLPreElement>('#fallbackHighlight');
  if (!fallback) {
    return;
  }
  if (!lines) {
    return;
  }
  if (!highlight) {
    return;
  }

  const measureCtx = document.createElement('canvas').getContext('2d');

  const estimateCharsPerVisualLine = (): number => {
    const style = window.getComputedStyle(fallback);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    if (measureCtx) {
      measureCtx.font = font;
    }

    const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const sampleWidth = measureCtx?.measureText(sample).width ?? 434;
    const avgCharWidth = Math.max(1, sampleWidth / sample.length);
    const horizontalPadding =
      Number.parseFloat(style.paddingLeft || '0') + Number.parseFloat(style.paddingRight || '0');
    const availableWidth = Math.max(24, fallback.clientWidth - horizontalPadding);
    return Math.max(1, Math.floor(availableWidth / avgCharWidth));
  };

  const syncLines = (): void => {
    lines.textContent = buildWrappedLineNumbers(fallback.value, estimateCharsPerVisualLine());
  };

  const syncHighlight = (): void => {
    highlight.innerHTML = `${highlightCSharp(fallback.value)}\n`;
  };

  wireFallbackCompiler(fallback, CSHARP_TEMPLATE, compiler, {
    setRules: (next) => {
      rules = next;
    },
    setStatus: (next) => {
      compileStatusEl.textContent = next;
    },
  });

  syncLines();
  syncHighlight();
  fallback.addEventListener('input', () => {
    syncLines();
    syncHighlight();
  });
  fallback.addEventListener('scroll', () => {
    lines.scrollTop = fallback.scrollTop;
    highlight.scrollTop = fallback.scrollTop;
    highlight.scrollLeft = fallback.scrollLeft;
  });
  window.addEventListener('resize', syncLines);
}

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

  const pendingMarkup = notes
    .map((note) => {
      const delta = note.timeSec - nowSec;
      const y = computeNoteYPercent(delta, leadSec, trailSec);
      const raw = 1 - Math.max(0, delta) / leadSec;
      const eased = Math.pow(Math.min(1, Math.max(0, raw)), 1.2);
      const scale = 0.64 + eased * 0.72;
      const opacity = 0.32 + eased * 0.68;
      if (note.holdDurationSec > 0) {
        const endY = computeNoteYPercent(
          note.timeSec + note.holdDurationSec - nowSec,
          leadSec,
          trailSec,
        );
        const top = Math.min(y, endY);
        const height = Math.max(8, Math.abs(endY - y));
        return `<div class="hold-tail hold-lane-${note.lane}" style="top:${top}%; height:${height}%"></div><div class="note note-lane-${note.lane} hold-head" style="top:${y}%; transform: translate(-50%, -50%) scale(${scale}); opacity:${opacity}"></div>`;
      }

      return `<div class="note note-lane-${note.lane}" style="top:${y}%; transform: translate(-50%, -50%) scale(${scale}); opacity:${opacity}"></div>`;
    })
    .join('');

  const activeHoldMarkup = Array.from(activeHolds.values())
    .map((hold) => {
      const remainingSec = Math.max(0, hold.endSec - nowSec);
      const endY = computeNoteYPercent(remainingSec, leadSec, trailSec);
      const hitLine = 85;
      const top = Math.min(hitLine, endY);
      const height = Math.max(10, hitLine - top);
      return `<div class="hold-active hold-lane-${hold.lane}" style="top:${top}%; height:${height}%"></div>`;
    })
    .join('');

  laneHighwayEl.innerHTML = pendingMarkup + activeHoldMarkup;
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
  displayText: string,
  lane: number | null,
): void {
  const spawnPerfectBurst = (laneButton: HTMLButtonElement): void => {
    const burst = document.createElement('div');
    burst.className = 'perfect-burst';
    for (let i = 0; i < 10; i += 1) {
      const spark = document.createElement('span');
      spark.className = 'spark';
      spark.style.setProperty('--a', `${(360 / 10) * i}deg`);
      spark.style.setProperty('--d', `${18 + (i % 3) * 7}px`);
      burst.appendChild(spark);
    }
    laneButton.appendChild(burst);
    window.setTimeout(() => {
      burst.remove();
    }, 380);
  };

  judgementPopEl.textContent = displayText;
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
      if (judgement === 'TOBULA') {
        spawnPerfectBurst(laneButton);
      }
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

function applyJudgement(judgement: Judgement, displayJudgement: string, lane: number | null): void {
  const before = state.getState().score;
  const next = state.apply(judgement, rules);
  const hypeStart = !before.hypeActive && next.hypeActive;
  const streakMilestone =
    judgement !== 'PRALEISTA' &&
    next.streak > 0 &&
    next.streak % 10 === 0 &&
    next.streak !== before.streak;

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
  updateHud(next.score, next.streak, mood === 'UZSIVEDIMAS' ? HYPE_LABEL : displayJudgement);
  showJudgementFeedback(judgement, displayJudgement, lane);
  if (judgement === 'TOBULA') {
    horseAnimator.emitPerfectNotes(lane);
  }
  audio.onJudgement(judgement, { hypeStart, streakMilestone, lane });
}

function setLaneHoldingClass(lane: number, holding: boolean): void {
  const laneButton = document.querySelector<HTMLButtonElement>(
    `.input-row button[data-lane="${lane}"]`,
  );
  if (!laneButton) {
    return;
  }

  laneButton.classList.toggle('holding', holding);
}

function startLanePress(
  hitTimeSec: number,
  lane: number,
  source: 'manual' | 'autoplay' = 'manual',
): void {
  audio.onPress(lane);

  const evaluation: HitEvaluation = engine.evaluateLaneHit(hitTimeSec, rules, lane);
  if (evaluation.judgement === 'PRALEISTA') {
    if (evaluation.timing === 'early') {
      applyJudgement('PRALEISTA', 'PER ANKSTI', lane);
      return;
    }

    if (evaluation.timing === 'late') {
      applyJudgement('PRALEISTA', 'PER VELAI', lane);
      return;
    }

    applyJudgement('PRALEISTA', 'PRALEISTA', lane);
    return;
  }

  if (evaluation.noteType === 'hold' && evaluation.holdEndSec !== null) {
    const baseJudgement = evaluation.judgement === 'TOBULA' ? 'TOBULA' : 'GERAI';
    activeHolds.set(lane, {
      lane,
      startSec: hitTimeSec,
      endSec: evaluation.holdEndSec,
      baseJudgement,
    });
    if (source === 'autoplay') {
      autoHeldLanes.add(lane);
    }
    audio.startHold(lane);
    mood = 'GERAI';
    const current = state.getState().score;
    updateHud(current.score, current.streak, 'LAIKYK');
    showJudgementFeedback('GERAI', 'LAIKYK', lane);
    setLaneHoldingClass(lane, true);
    return;
  }

  applyJudgement(evaluation.judgement, evaluation.judgement, lane);
}

function releaseLanePress(releaseTimeSec: number, lane: number): void {
  const hold = activeHolds.get(lane);
  if (!hold) {
    return;
  }

  activeHolds.delete(lane);
  autoHeldLanes.delete(lane);
  audio.stopHold(lane);
  setLaneHoldingClass(lane, false);

  if (releaseTimeSec + rules.gerasLangas < hold.endSec) {
    applyJudgement('PRALEISTA', 'PALEIDAI PER ANKSTI', lane);
    return;
  }

  applyJudgement(hold.baseJudgement, hold.baseJudgement, lane);
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
        if (autoHeldLanes.has(note.lane)) {
          continue;
        }
        autoPlayedBeatIds.add(note.id);
        startLanePress(note.timeSec, note.lane, 'autoplay');
      }
    }

    const songLookBehindSec = 0.18;
    const songLookAheadSec = 0.06;
    const songNotes = engine.getBeatsInRange(now - songLookBehindSec, now + songLookAheadSec, true);
    for (const note of songNotes) {
      if (songPlayedBeatIds.has(note.id)) {
        continue;
      }

      if (!audio.isUnlocked()) {
        audio.unlock();
        continue;
      }

      songPlayedBeatIds.add(note.id);
      audio.playSongGuideNote(note.toneHz, note.holdDurationSec);
      audio.playSongBacking(note.toneHz, note.holdDurationSec);
    }

    for (const [lane, hold] of activeHolds) {
      if (now >= hold.endSec) {
        activeHolds.delete(lane);
        autoHeldLanes.delete(lane);
        audio.stopHold(lane);
        setLaneHoldingClass(lane, false);
        applyJudgement(hold.baseJudgement, hold.baseJudgement, lane);
      }
    }

    const missed = engine.consumeMissed(now, rules.gerasLangas + 0.08);
    for (let i = 0; i < missed; i += 1) {
      applyJudgement('PRALEISTA', 'PRALEISTA', null);
    }
    renderLanes(now);
    const holdingLane = activeHolds.values().next().value?.lane ?? null;
    horseAnimator.render(timeMs, mood, rules, activeHolds.size > 0, holdingLane);
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

async function initEditor(): Promise<void> {
  if (shouldUseSimpleEditor()) {
    mountSimpleEditor();
    return;
  }

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
    mountSimpleEditor();
  }
}

function wireInputs(): void {
  const isTypingTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    if (target.closest('.monaco-editor, .fallback-editor, #editor, .code-studio')) {
      return true;
    }

    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  };

  const pulseLaneButton = (lane: number): void => {
    const laneButton = document.querySelector<HTMLButtonElement>(
      `.input-row button[data-lane="${lane}"]`,
    );
    if (!laneButton) {
      return;
    }

    laneButton.classList.add('hit');
    window.setTimeout(() => laneButton.classList.remove('hit'), 120);
  };

  const vibrateTap = (): void => {
    if (!('vibrate' in navigator)) {
      return;
    }

    navigator.vibrate(12);
  };

  document.querySelectorAll<HTMLButtonElement>('.input-row button').forEach((button) => {
    const lane = Number(button.dataset.lane);
    button.addEventListener(
      'touchstart',
      (event) => {
        event.preventDefault();
        audio.unlock();
        if (pressedLanes.has(lane)) {
          return;
        }
        pressedLanes.add(lane);
        pulseLaneButton(lane);
        vibrateTap();
        startLanePress(performance.now() / 1000, lane);
      },
      { passive: false },
    );

    button.addEventListener('touchend', () => {
      if (!pressedLanes.has(lane)) {
        return;
      }
      pressedLanes.delete(lane);
      releaseLanePress(performance.now() / 1000, lane);
    });

    button.addEventListener('touchcancel', () => {
      if (!pressedLanes.has(lane)) {
        return;
      }
      pressedLanes.delete(lane);
      releaseLanePress(performance.now() / 1000, lane);
    });

    button.addEventListener('mousedown', () => {
      audio.unlock();
      if (pressedLanes.has(lane)) {
        return;
      }
      pressedLanes.add(lane);
      pulseLaneButton(lane);
      startLanePress(performance.now() / 1000, lane);
    });

    button.addEventListener('mouseup', () => {
      if (!pressedLanes.has(lane)) {
        return;
      }
      pressedLanes.delete(lane);
      releaseLanePress(performance.now() / 1000, lane);
    });

    button.addEventListener('mouseleave', () => {
      if (!pressedLanes.has(lane)) {
        return;
      }
      pressedLanes.delete(lane);
      releaseLanePress(performance.now() / 1000, lane);
    });
  });

  window.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    const lane = normalizeLaneFromKey(event.key);
    if (lane === null) {
      return;
    }

    event.preventDefault();
    audio.unlock();
    if (pressedLanes.has(lane)) {
      return;
    }
    pressedLanes.add(lane);
    pulseLaneButton(lane);
    startLanePress(performance.now() / 1000, lane);
  });

  window.addEventListener('keyup', (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    const lane = normalizeLaneFromKey(event.key);
    if (lane === null) {
      return;
    }

    if (!pressedLanes.has(lane)) {
      return;
    }
    pressedLanes.delete(lane);
    releaseLanePress(performance.now() / 1000, lane);
  });
}

requestAnimationFrame(resizeCanvas);
state.goTo('play');
state.resetRun();

autoplayToggleEl.addEventListener('click', () => {
  audio.unlock();
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
      playNearestTapAny(offsetSec: number): boolean;
      playLaneAt(lane: number, atSec: number): boolean;
      peekUpcomingTapAny(minAheadSec: number): { id: number; timeSec: number; lane: number } | null;
      wasSongBeatPlayed(beatId: number): boolean;
      peekNearestLane(lane: number): { id: number; timeSec: number; lane: number } | null;
      peekNearestAny(): { id: number; timeSec: number; lane: number } | null;
      peekNearestHold(lane: number): {
        id: number;
        timeSec: number;
        lane: number;
        holdDurationSec: number;
      } | null;
      peekNearestHoldAny(): {
        id: number;
        timeSec: number;
        lane: number;
        holdDurationSec: number;
      } | null;
      releaseLaneAt(lane: number, atSec: number): void;
      read(): {
        score: number;
        streak: number;
        judgement: string;
      };
      readHoldState(): { activeHolds: number; autoHeldLanes: number };
      readVisualState(): {
        arklioSpalva: string;
        karciuSpalva: string;
        suKepure: boolean;
        oroEfektas: string;
        mood: HorseMood;
      };
      getRules(): DanceRules;
      readAudioState(): {
        guideNotesRequested: number;
        guideNotesPlayed: number;
        backingNotesRequested: number;
        backingNotesPlayed: number;
      };
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
    songPlayedBeatIds.clear();
    autoHeldLanes.clear();
    audio.stopAllHolds();
    audio.resetDebugState();
    activeHolds.clear();
    pressedLanes.clear();
    document.querySelectorAll<HTMLButtonElement>('.input-row button').forEach((button) => {
      button.classList.remove('holding');
    });
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

    startLanePress(note.timeSec + offsetSec, lane);
    return true;
  },
  playNearestAny(offsetSec: number): boolean {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, 3)[0];
    if (!note) {
      return false;
    }

    startLanePress(note.timeSec + offsetSec, note.lane);
    return true;
  },
  playNearestTapAny(offsetSec: number): boolean {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine
      .getBeatsInRange(now, 8)
      .find((candidate) => candidate.holdDurationSec === 0);
    if (!note) {
      return false;
    }

    startLanePress(note.timeSec + offsetSec, note.lane);
    return true;
  },
  playLaneAt(lane: number, atSec: number): boolean {
    startLanePress(atSec, lane);
    return true;
  },
  peekUpcomingTapAny(minAheadSec: number): { id: number; timeSec: number; lane: number } | null {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine
      .getBeatsInRange(now + Math.max(0, minAheadSec), 6)
      .find((candidate) => candidate.holdDurationSec === 0);
    return note ? { id: note.id, timeSec: note.timeSec, lane: note.lane } : null;
  },
  wasSongBeatPlayed(beatId: number): boolean {
    return songPlayedBeatIds.has(beatId);
  },
  peekNearestLane(lane: number): { id: number; timeSec: number; lane: number } | null {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, 3).find((candidate) => candidate.lane === lane);
    return note ?? null;
  },
  peekNearestAny(): { id: number; timeSec: number; lane: number } | null {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, 3)[0];
    return note ? { id: note.id, timeSec: note.timeSec, lane: note.lane } : null;
  },
  peekNearestHold(
    lane: number,
  ): { id: number; timeSec: number; lane: number; holdDurationSec: number } | null {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine
      .getBeatsInRange(now, 4)
      .find((candidate) => candidate.lane === lane && candidate.holdDurationSec > 0);
    return note ?? null;
  },
  peekNearestHoldAny(): {
    id: number;
    timeSec: number;
    lane: number;
    holdDurationSec: number;
  } | null {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, 4).find((candidate) => candidate.holdDurationSec > 0);
    return note ?? null;
  },
  releaseLaneAt(lane: number, atSec: number): void {
    releaseLanePress(atSec, lane);
  },
  read(): { score: number; streak: number; judgement: string } {
    return {
      score: Number(scoreEl.textContent ?? '0'),
      streak: Number(streakEl.textContent ?? '0'),
      judgement: judgementEl.textContent ?? 'PRALEISTA',
    };
  },
  readHoldState(): { activeHolds: number; autoHeldLanes: number } {
    return {
      activeHolds: activeHolds.size,
      autoHeldLanes: autoHeldLanes.size,
    };
  },
  readVisualState(): {
    arklioSpalva: string;
    karciuSpalva: string;
    suKepure: boolean;
    oroEfektas: string;
    mood: HorseMood;
  } {
    return horseAnimator.getVisualState();
  },
  getRules(): DanceRules {
    return rules;
  },
  readAudioState(): {
    guideNotesRequested: number;
    guideNotesPlayed: number;
    backingNotesRequested: number;
    backingNotesPlayed: number;
  } {
    return audio.readDebugState();
  },
};

void compiler.init();
void initEditor();
wireCompileHelp();
wireAudioBootstrap();
wireInputs();
startLoop();
