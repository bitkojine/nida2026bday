import './style.css';
import { GameAudio } from './audio/gameAudio';
import { DEDICATION_TEXT } from './core/dedicationBanner';
import {
  clearPersistedEditorSource,
  EDITOR_SOURCE_STORAGE_KEY,
  readPersistedEditorSource,
  writePersistedEditorSource,
} from './core/editorSourceStorage';
import { GameStateManager } from './core/gameStateManager';
import { normalizeLaneFromKey } from './core/inputController';
import { buildLayoutMetrics } from './core/layoutManager';
import { computeNoteYPercent } from './core/noteLayout';
import type { HitEvaluation } from './core/rhythmEngine';
import { RhythmEngine } from './core/rhythmEngine';
import { createRuntimeScope } from './core/runtimeScope';
import { planSongPlaybackBatch } from './core/songPlaybackPlanner';
import { DEFAULT_SONG_MAP } from './core/songMap';
import {
  DEFAULT_RULES,
  type CompileResult,
  type DanceRules,
  type HorseMood,
  type Judgement,
} from './core/types';
import {
  HorseAnimator,
  renderWeatherScene,
  type TechnicalNoticeIconHit,
  type WeatherSceneRenderMode,
} from './render/horseAnimator';
import { CodeCompilerService } from './services/codeCompilerService';
import { CSHARP_TEMPLATE } from './services/csharpTemplate';
import { createLatestCompileApplier, wireFallbackCompiler } from './ui/compileFeedback';
import { CODE_PUZZLES, evaluatePuzzleProgress } from './ui/codePuzzles';
import { applyDanceRuleTemplate, DANCE_RULE_TEMPLATES } from './ui/danceRuleTemplates';
import { highlightCSharp } from './ui/fallbackSyntaxHighlighter';
import {
  bindAudioBootstrapBindings,
  bindElementClick,
  bindSimpleEditorResizeBindings,
  bindWindowLifecycle,
  bindWindowResize,
} from './ui/lifecycleBindings';
import { buildWrappedLineNumbers } from './ui/lineNumberGutter';
import { mountMonacoEditor } from './ui/monacoEditor';

declare const __BUILD_VILNIUS_TIME__: string;
interface BuildGitLargestFile {
  path: string;
  bytes: number;
}

interface BuildGitHistoryChurnEntry {
  path: string;
  totalBytes: number;
  blobCount: number;
}

interface BuildGitRepoStats {
  available: boolean;
  branch: string;
  commit: string;
  trackedFileCount: number;
  gitDirBytes: number;
  gitObjectCount: number | null;
  gitLooseSizeBytes: number | null;
  gitPackSizeBytes: number | null;
  largestTrackedFiles: BuildGitLargestFile[];
  historyChurn: BuildGitHistoryChurnEntry[];
  error?: string;
}

declare const __GIT_REPO_STATS__: BuildGitRepoStats;

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
  <canvas id="weatherSceneCanvas" aria-hidden="true"></canvas>
  <main class="layout">
    <aside class="compile-notice-rail" id="compileNoticeRail" hidden>
      <div class="compile-notice-card">
        <p class="compile-notice-text" id="compileNoticeText">KODAS NESIKOMPILIUOJA</p>
        <button
          class="compile-notice-toggle"
          id="compileNoticeToggle"
          type="button"
          aria-label="Rodyti daugiau informacijos"
          aria-expanded="false"
          title="Daugiau informacijos"
        >
          ?
        </button>
      </div>
    </aside>
    <section class="game" id="gameScreen">
      <p class="hero-copy" id="heroCopy">
        <strong>🎁 Šokanti Arklio Ritmo Dovana</strong><br>
        ${DEDICATION_TEXT}<br>
        Versija: ${__BUILD_VILNIUS_TIME__} (Lietuvos laikas)
      </p>
      <header class="hud">
        <div><strong>Taškai</strong><span id="score">0</span></div>
        <div><strong>Serija</strong><span id="streak">0</span></div>
        <div><strong>Daugiklis</strong><span id="multiplier">x1</span></div>
        <div><strong>Vertinimas</strong><span id="judgement">PRALEISTA</span></div>
        <button class="autoplay-toggle" id="autoplayToggle" type="button">Žaisti automatiškai: TAIP</button>
        <button class="mute-toggle" id="muteToggle" type="button">Garsas: ĮJUNGTAS</button>
      </header>

      <section class="horse-stage" aria-label="Arklio scena">
        <canvas id="horseCanvas" aria-label="Šokantis arklys"></canvas>
        <aside class="horse-compile-notice" id="horseCompileNotice" hidden>
          <pre class="horse-compile-notice-text" id="horseCompileNoticeText">KODAS NESIKOMPILIUOJA</pre>
          <button
            class="horse-compile-notice-toggle"
            id="horseCompileNoticeToggle"
            type="button"
            aria-label="Rodyti daugiau informacijos"
            aria-expanded="false"
            title="Daugiau informacijos"
          >
            ?
          </button>
        </aside>
      </section>

      <section class="highway-shell" aria-label="Ritmo juostos">
        <div class="highway" id="laneHighway" aria-hidden="true"></div>
        <div class="autoplay-overlay" id="autoplayOverlay" aria-live="polite">
          DABAR ŽAIDŽIAMA AUTOMATIŠKAI
        </div>
        <div class="hit-line"></div>
        <div class="judgement-pop" id="judgementPop">PRALEISTA</div>
      </section>

      <div class="input-row" id="inputRow">
        <button data-lane="0" aria-label="Kairė"><span>←</span></button>
        <button data-lane="1" aria-label="Žemyn"><span>↓</span></button>
        <button data-lane="2" aria-label="Aukštyn"><span>↑</span></button>
        <button data-lane="3" aria-label="Dešinė"><span>→</span></button>
      </div>

      <section class="puzzle-panel" aria-label="Programavimo misijos">
        <div class="puzzle-head">
          <strong>Mokymosi misijos</strong>
          <span id="puzzleProgress">0 / 5</span>
        </div>
        <p class="puzzle-story" id="puzzleStory"></p>
        <p class="puzzle-goal" id="puzzleGoal"></p>
        <p class="puzzle-hint" id="puzzleHint"></p>
        <p class="puzzle-done" id="puzzleDone" hidden>
          Puiku! Arklys sugrojo „Su gimtadieniu“ iki galo. 🎶 🎁 Šablonų atlygis atrakintas!
        </p>
        <p class="puzzle-lock-note" id="templateLockNote">
          <span class="puzzle-label">🎁 Atlygis:</span> šablonai. Užbaik visas misijas ir atrakink šablonų mygtukus!
        </p>
      </section>

      <details class="code-studio">
        <summary class="collapsible-title">💻 C# studija: keisk žaidimo taisykles</summary>
        <section class="editor-panel" id="editorPanel">
          <div id="editor" class="editor"></div>
          <button
            class="editor-resizer"
            id="editorResizer"
            type="button"
            aria-label="Keisti kodo lango aukštį"
            title="Keisti kodo lango aukštį"
          ></button>
        </section>
        <section id="templateReward" class="template-panel" aria-label="C# šablonai" hidden>
          <p class="template-title">Greiti šablonai: išbandyk, kas įmanoma</p>
          <div class="template-row">
            ${DANCE_RULE_TEMPLATES.map(
              (template) =>
                `<button class="template-btn" type="button" data-template-id="${template.id}" title="${template.descriptionLt}">${template.labelLt}</button>`,
            ).join('')}
          </div>
        </section>
      </details>
      <details class="perf-stack" aria-label="Našumo statistika">
        <summary class="collapsible-title">ℹ️ Papildoma informacija apie žaidimą</summary>
        <div class="perf-stack-body">
          <canvas id="audioVisualizer" class="audio-visualizer" aria-label="Garso vizualizatorius"></canvas>
          <p class="perf-stats" id="perfStats">Našumas: tikrinama...</p>
          <section class="danger-zone" aria-label="Pavojinga zona">
            <h3 class="danger-zone-title">Pavojinga zona</h3>
            <p class="danger-zone-copy">
              Čia gali atlikti rizikingus veiksmus: atstatyti tik C# kodą, atstatyti visą žaidimo būseną arba
              su patvirtinimo kodu atrakinti visas misijas.
            </p>
            <div class="danger-zone-actions">
              <button class="danger-reset-btn" id="resetCodeButton" type="button">
                Atstatyti tik C# kodą
              </button>
              <button class="danger-reset-btn" id="resetProgressButton" type="button">
                Atstatyti visą žaidimą (progresą, kodą ir garsą)
              </button>
              <button class="danger-reset-btn" id="unlockAllMissionsButton" type="button">
                Atrakinti visas misijas
              </button>
            </div>
          </section>
        </div>
      </details>
      <dialog class="danger-dialog" id="resetProgressDialog" aria-labelledby="resetProgressTitle">
        <h3 class="danger-dialog-title" id="resetProgressTitle">Patvirtink progreso ištrynimą</h3>
        <p class="danger-dialog-copy">
          Įrašyk <code>yes reset</code>, kad patvirtintum šį neatšaukiamą veiksmą.
        </p>
        <label class="danger-dialog-label" for="resetProgressConfirmInput">Patvirtinimas</label>
        <input
          class="danger-dialog-input"
          id="resetProgressConfirmInput"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="yes reset"
        />
        <div class="danger-dialog-actions">
          <button class="danger-dialog-cancel" id="resetProgressCancelButton" type="button">Atšaukti</button>
          <button class="danger-dialog-confirm" id="resetProgressConfirmButton" type="button" disabled>
            Ištrinti progresą
          </button>
        </div>
      </dialog>
      <dialog class="danger-dialog" id="resetCodeDialog" aria-labelledby="resetCodeTitle">
        <h3 class="danger-dialog-title" id="resetCodeTitle">Patvirtink C# kodo atstatymą</h3>
        <p class="danger-dialog-copy">
          Įrašyk <code>reset code</code>, kad atstatytum tik C# kodą į numatytąją būseną.
        </p>
        <label class="danger-dialog-label" for="resetCodeConfirmInput">Patvirtinimas</label>
        <input
          class="danger-dialog-input"
          id="resetCodeConfirmInput"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="reset code"
        />
        <div class="danger-dialog-actions">
          <button class="danger-dialog-cancel" id="resetCodeCancelButton" type="button">Atšaukti</button>
          <button class="danger-dialog-confirm" id="resetCodeConfirmButton" type="button" disabled>
            Atstatyti kodą
          </button>
        </div>
      </dialog>
      <dialog
        class="danger-dialog"
        id="unlockAllMissionsDialog"
        aria-labelledby="unlockAllMissionsTitle"
      >
        <h3 class="danger-dialog-title" id="unlockAllMissionsTitle">Atrakinti visas misijas</h3>
        <p class="danger-dialog-copy">
          Įrašyk slaptą patvirtinimo kodą, kad visos mokymosi misijos būtų pažymėtos kaip įvykdytos.
        </p>
        <label class="danger-dialog-label" for="unlockAllMissionsConfirmInput">Patvirtinimo kodas</label>
        <input
          class="danger-dialog-input"
          id="unlockAllMissionsConfirmInput"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="slaptas kodas"
        />
        <div class="danger-dialog-actions">
          <button class="danger-dialog-cancel" id="unlockAllMissionsCancelButton" type="button">
            Atšaukti
          </button>
          <button
            class="danger-dialog-confirm"
            id="unlockAllMissionsConfirmButton"
            type="button"
            disabled
          >
            Atrakinti misijas
          </button>
        </div>
      </dialog>
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
const muteToggleEl = requiredElement<HTMLButtonElement>('#muteToggle');
const autoplayOverlayEl = requiredElement<HTMLElement>('#autoplayOverlay');
const audioVisualizerEl = requiredElement<HTMLCanvasElement>('#audioVisualizer');
const perfStatsEl = requiredElement<HTMLElement>('#perfStats');
const perfStackEl = requiredElement<HTMLDetailsElement>('.perf-stack');
const unlockAllMissionsButtonEl = requiredElement<HTMLButtonElement>('#unlockAllMissionsButton');
const unlockAllMissionsDialogEl = requiredElement<HTMLDialogElement>('#unlockAllMissionsDialog');
const unlockAllMissionsConfirmInputEl = requiredElement<HTMLInputElement>(
  '#unlockAllMissionsConfirmInput',
);
const unlockAllMissionsCancelButtonEl = requiredElement<HTMLButtonElement>(
  '#unlockAllMissionsCancelButton',
);
const unlockAllMissionsConfirmButtonEl = requiredElement<HTMLButtonElement>(
  '#unlockAllMissionsConfirmButton',
);
const resetProgressButtonEl = requiredElement<HTMLButtonElement>('#resetProgressButton');
const resetProgressDialogEl = requiredElement<HTMLDialogElement>('#resetProgressDialog');
const resetProgressConfirmInputEl = requiredElement<HTMLInputElement>('#resetProgressConfirmInput');
const resetProgressCancelButtonEl = requiredElement<HTMLButtonElement>(
  '#resetProgressCancelButton',
);
const resetProgressConfirmButtonEl = requiredElement<HTMLButtonElement>(
  '#resetProgressConfirmButton',
);
const resetCodeButtonEl = requiredElement<HTMLButtonElement>('#resetCodeButton');
const resetCodeDialogEl = requiredElement<HTMLDialogElement>('#resetCodeDialog');
const resetCodeConfirmInputEl = requiredElement<HTMLInputElement>('#resetCodeConfirmInput');
const resetCodeCancelButtonEl = requiredElement<HTMLButtonElement>('#resetCodeCancelButton');
const resetCodeConfirmButtonEl = requiredElement<HTMLButtonElement>('#resetCodeConfirmButton');
const puzzleProgressEl = requiredElement<HTMLElement>('#puzzleProgress');
const puzzleStoryEl = requiredElement<HTMLElement>('#puzzleStory');
const puzzleGoalEl = requiredElement<HTMLElement>('#puzzleGoal');
const puzzleHintEl = requiredElement<HTMLElement>('#puzzleHint');
const puzzleDoneEl = requiredElement<HTMLElement>('#puzzleDone');
const templateLockNoteEl = requiredElement<HTMLElement>('#templateLockNote');
const templateRewardEl = requiredElement<HTMLElement>('#templateReward');
const laneHighwayEl = requiredElement<HTMLElement>('#laneHighway');
const codeStudioEl = requiredElement<HTMLDetailsElement>('.code-studio');
const editorPanelEl = requiredElement<HTMLElement>('#editorPanel');
const editorResizerEl = requiredElement<HTMLButtonElement>('#editorResizer');
const canvas = requiredElement<HTMLCanvasElement>('#horseCanvas');
const weatherSceneCanvas = requiredElement<HTMLCanvasElement>('#weatherSceneCanvas');
const compileNoticeRailEl = requiredElement<HTMLElement>('#compileNoticeRail');
const compileNoticeTextEl = requiredElement<HTMLElement>('#compileNoticeText');
const compileNoticeToggleEl = requiredElement<HTMLButtonElement>('#compileNoticeToggle');
const horseCompileNoticeEl = requiredElement<HTMLElement>('#horseCompileNotice');
const horseCompileNoticeTextEl = requiredElement<HTMLElement>('#horseCompileNoticeText');
const horseCompileNoticeToggleEl = requiredElement<HTMLButtonElement>('#horseCompileNoticeToggle');
const editorHost = requiredElement<HTMLDivElement>('#editor');

const state = new GameStateManager();
const engine = new RhythmEngine(92, performance.now() / 1000, DEFAULT_SONG_MAP);
const compiler = new CodeCompilerService();
const silentAudio =
  (window as Window & { __E2E_SILENT_AUDIO__?: boolean }).__E2E_SILENT_AUDIO__ === true ||
  new URLSearchParams(window.location.search).get('muteAudio') === '1' ||
  navigator.webdriver;
const audio = new GameAudio(silentAudio);
const HYPE_LABEL = 'UŽSIVEDĘS';
const FOOTER_CREDITS_LINE = 'Sukurta su meile Roberto Rudžio, 2026 m.';
const REPO_URL = 'https://github.com/bitkojine/nida2026bday';
const RESET_CONFIRMATION_PHRASE = 'yes reset';
const RESET_CODE_CONFIRMATION_PHRASE = 'reset code';
const UNLOCK_MISSIONS_CODE_HASH_SHA256 =
  '51d4c79aa78e1fdb405ebcafe7922d38278da939f411c9980a2a57cd954a8c28';
const HUD_VALUE_MAX_FONT_PX = 14;
const HUD_VALUE_MIN_FONT_PX = 9;
const TOGGLE_LABEL_MAX_FONT_PX = 12;
const TOGGLE_LABEL_MIN_FONT_PX = 8;
const IS_COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;
const MOBILE_PERF_MAX_WIDTH_PX = 900;
const PUZZLE_PROGRESS_STORAGE_KEY = 'nida2026bday:puzzlesSolvedCount:v1';
const SOUND_MUTED_STORAGE_KEY = 'nida2026bday:soundMuted:v1';
const LOCAL_STORAGE_KEYS_USED = [
  PUZZLE_PROGRESS_STORAGE_KEY,
  SOUND_MUTED_STORAGE_KEY,
  EDITOR_SOURCE_STORAGE_KEY,
];
const EDITOR_PANEL_MIN_HEIGHT_PX = 220;
const EDITOR_PANEL_MAX_HEIGHT_PX = 2000;
const EDITOR_PANEL_VERTICAL_PADDING_PX = 40;
const EDITOR_PANEL_AUTOSIZE_FUDGE_PX = 2;
const WEATHER_SCENE_MAX_DPR = 1.25;
const WEATHER_SCENE_MAX_PIXELS = 2_200_000;
const WEATHER_VISUAL_FPS_COARSE = 22;
const WEATHER_VISUAL_FPS_FINE = 60;
const AUDIO_VIZ_FPS_COARSE = 28;
const AUDIO_VIZ_FPS_FINE = 60;
const HORSE_VISUAL_FPS_COARSE = 34;
const HORSE_VISUAL_FPS_FINE = 60;
const LANE_VISUAL_FPS_COARSE = 34;
const LANE_VISUAL_FPS_FINE = 60;
const COMPILE_NOTICE_RAIL_MIN_WIDTH_PX = 1080;

let rules: DanceRules = DEFAULT_RULES;
let mood: HorseMood = 'GERAI';
let compileTimer: number | null = null;
let loopRafId: number | null = null;
let audioRetryIntervalId: number | null = null;
let lastFrameTimeMs: number | null = null;
let lastVisualRenderMs = 0;
let lastWeatherRenderMs = -Number.MAX_VALUE;
let lastAudioVizRenderMs = -Number.MAX_VALUE;
let lastHorseRenderMs = -Number.MAX_VALUE;
let lastLaneRenderMs = -Number.MAX_VALUE;
let perfWindowStartMs = performance.now();
let perfFrameCount = 0;
let perfFrameMsTotal = 0;
let latestMeasuredFps = 0;
let latestMeasuredFrameMs = 0;
let perfLastMemorySampleMs = 0;
let perfMemorySampleInFlight = false;
let perfMemoryText = 'tikrinama...';
interface LocalStorageDebugStats {
  availability: string;
  keyCount: string;
  ownKeys: string;
  ownKeyValues: string[];
  approxUsed: string;
  browserStorage: string;
}

function buildPendingLocalStorageDebugStats(): LocalStorageDebugStats {
  return {
    availability: 'tikrinama...',
    keyCount: 'tikrinama...',
    ownKeys: 'tikrinama...',
    ownKeyValues: LOCAL_STORAGE_KEYS_USED.map(() => 'tikrinama...'),
    approxUsed: 'tikrinama...',
    browserStorage: 'tikrinama...',
  };
}

let perfLocalStorageStats = buildPendingLocalStorageDebugStats();
let lastPerfStatsIndentPx = -1;
let lastLaneMarkup = '';
let lastVisibleNoteCount = 0;
let latestVisualizerBars: number[] = new Array(52).fill(0);
let disposed = false;
let autoplayEnabled = true;
let soundMuted = false;
let compileIsValid = true;
let latestCompileResult: CompileResult | null = null;
let cachedTechnicalNoticeSignature = '';
let cachedTechnicalNoticeLines: string[] | null = null;
let technicalNoticeExpanded = false;
let weatherTechnicalNoticeIconHit: TechnicalNoticeIconHit | null = null;
let pendingEditorSource: string | null = null;
let editorPanelAutoSized = false;
let canvasStabilizeRafId: number | null = null;
let weatherSceneDpr = 1;
const fallbackMeasureCtx = document.createElement('canvas').getContext('2d');
const ensureTrailingEmptyLine = (source: string): string => {
  const withoutTrailingBreaks = source.replace(/[\r\n]+$/g, '');
  return `${withoutTrailingBreaks}\n`;
};

function readBrowserLocalStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readInitialEditorSource(): string {
  const fallback = ensureTrailingEmptyLine(CSHARP_TEMPLATE);
  const storage = readBrowserLocalStorageOrNull();
  if (!storage) {
    return fallback;
  }
  return ensureTrailingEmptyLine(readPersistedEditorSource(storage, fallback));
}

function persistEditorSource(source: string): void {
  const storage = readBrowserLocalStorageOrNull();
  if (!storage) {
    return;
  }
  writePersistedEditorSource(storage, ensureTrailingEmptyLine(source));
}

const INITIAL_EDITOR_SOURCE = readInitialEditorSource();
let readEditorSource = (): string => pendingEditorSource ?? INITIAL_EDITOR_SOURCE;
let writeEditorSource = (next: string): void => {
  const normalized = ensureTrailingEmptyLine(next);
  pendingEditorSource = normalized;
  persistEditorSource(normalized);
};
const audioBootstrapScope = createRuntimeScope();
const editorScope = createRuntimeScope();
const inputScope = createRuntimeScope();
const canvasScope = createRuntimeScope();
const autoplayScope = createRuntimeScope();
const windowLifecycleScope = createRuntimeScope();
const templateScope = createRuntimeScope();
const editorResizeScope = createRuntimeScope();
const dangerZoneScope = createRuntimeScope();
let persistedSolvedPuzzleCount = 0;
const autoPlayedBeatIds = new Set<number>();
const songPlayedBeatIds = new Set<number>();
const MAX_TRACKED_AUTO_PLAYED_BEATS = 256;
const MAX_TRACKED_SONG_PLAYED_BEATS = 512;
const pendingSongBeats = new Map<
  number,
  { id: number; timeSec: number; toneHz: number; holdDurationSec: number }
>();
const autoHeldLanes = new Set<number>();
const pressedLanes = new Set<number>();
const keyHeldLanes = new Set<number>();

interface ActiveHold {
  lane: number;
  startSec: number;
  endSec: number;
  baseJudgement: 'TOBULA' | 'GERAI';
}

const activeHolds = new Map<number, ActiveHold>();

function autoSizeEditorPanelForInitialLoad(visualLineCount: number, lineHeightPx: number): void {
  if (editorPanelAutoSized) {
    return;
  }

  const safeLineCount = Math.max(1, Math.round(visualLineCount));
  const safeLineHeightPx = Math.max(14, Math.min(40, lineHeightPx));
  const targetHeightPx = Math.round(
    safeLineCount * safeLineHeightPx + EDITOR_PANEL_VERTICAL_PADDING_PX,
  );
  const clampedHeightPx = Math.max(
    EDITOR_PANEL_MIN_HEIGHT_PX,
    Math.min(EDITOR_PANEL_MAX_HEIGHT_PX, targetHeightPx),
  );
  editorPanelEl.style.height = `${clampedHeightPx}px`;
  editorPanelAutoSized = true;
}

function parseCssPx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateFallbackCharsPerVisualLine(fallback: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(fallback);
  if (fallbackMeasureCtx) {
    fallbackMeasureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  }
  const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const sampleWidth = fallbackMeasureCtx?.measureText(sample).width ?? 434;
  const avgCharWidth = Math.max(1, sampleWidth / sample.length);
  const horizontalPadding = parseCssPx(style.paddingLeft) + parseCssPx(style.paddingRight);
  const availableWidth = Math.max(24, fallback.clientWidth - horizontalPadding);
  return Math.max(1, Math.floor(availableWidth / avgCharWidth));
}

function estimateFallbackContentHeightPx(fallback: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(fallback);
  const lineHeightPx = Math.max(
    14,
    parseCssPx(style.lineHeight) || parseCssPx(style.fontSize) * 1.45,
  );
  const verticalPadding = parseCssPx(style.paddingTop) + parseCssPx(style.paddingBottom);
  const visualLineCount = Math.max(
    1,
    buildWrappedLineNumbers(fallback.value, estimateFallbackCharsPerVisualLine(fallback))
      .split('\n')
      .filter((line) => line.trim().length > 0).length,
  );
  return Math.round(visualLineCount * lineHeightPx + verticalPadding);
}

function computeFallbackRequiredPanelHeightPx(fallback: HTMLTextAreaElement): number {
  const hasOverflow = fallback.scrollHeight > fallback.clientHeight + 1;
  const contentHeightPx = hasOverflow
    ? Math.max(1, Math.round(fallback.scrollHeight))
    : estimateFallbackContentHeightPx(fallback);
  return Math.max(
    EDITOR_PANEL_MIN_HEIGHT_PX,
    Math.min(
      EDITOR_PANEL_MAX_HEIGHT_PX,
      Math.round(contentHeightPx + EDITOR_PANEL_AUTOSIZE_FUDGE_PX),
    ),
  );
}

function fitEditorPanelToFallbackContent(fallback: HTMLTextAreaElement): void {
  const targetHeightPx = computeFallbackRequiredPanelHeightPx(fallback);
  const currentHeightPx = Math.round(editorPanelEl.getBoundingClientRect().height);
  if (Math.abs(targetHeightPx - currentHeightPx) <= 1) {
    editorPanelAutoSized = true;
    return;
  }
  editorPanelEl.style.height = `${targetHeightPx}px`;
  editorPanelAutoSized = true;
}

function stabilizeEditorPanelAutoSize(fallback: HTMLTextAreaElement, remainingFrames = 8): void {
  if (remainingFrames <= 0) {
    return;
  }

  fitEditorPanelToFallbackContent(fallback);
  const overflowPx = fallback.scrollHeight - fallback.clientHeight;
  if (overflowPx <= 1) {
    return;
  }

  window.requestAnimationFrame(() => {
    stabilizeEditorPanelAutoSize(fallback, remainingFrames - 1);
  });
}

function tryAutoSizeEditorPanelForInitialLoad(): void {
  if (editorPanelAutoSized) {
    return;
  }

  if (!codeStudioEl.open) {
    return;
  }

  if (editorPanelEl.clientWidth <= 0 || editorPanelEl.clientHeight <= 0) {
    return;
  }

  const fallback = document.querySelector<HTMLTextAreaElement>('#fallbackCode');
  if (fallback && fallback.clientWidth > 0) {
    fitEditorPanelToFallbackContent(fallback);
    return;
  }

  const lineCount = readEditorSource().split('\n').length;
  autoSizeEditorPanelForInitialLoad(lineCount, 19);
}

function growEditorPanelToFitFallbackContent(fallback: HTMLTextAreaElement): void {
  const currentHeightPx = Math.round(editorPanelEl.getBoundingClientRect().height);
  const targetHeightPx = computeFallbackRequiredPanelHeightPx(fallback);
  if (targetHeightPx <= currentHeightPx + 1) {
    return;
  }

  editorPanelEl.style.height = `${targetHeightPx}px`;
}

const ctxOrNull = canvas.getContext('2d');
if (!ctxOrNull) {
  throw new Error('Canvas context unavailable');
}
const ctx: CanvasRenderingContext2D = ctxOrNull;
const weatherSceneCtxOrNull = weatherSceneCanvas.getContext('2d');
if (!weatherSceneCtxOrNull) {
  throw new Error('Weather scene context unavailable');
}
const weatherSceneCtx: CanvasRenderingContext2D = weatherSceneCtxOrNull;
const audioVizCtxOrNull = audioVisualizerEl.getContext('2d');
if (!audioVizCtxOrNull) {
  throw new Error('Audio visualizer context unavailable');
}
const audioVizCtx: CanvasRenderingContext2D = audioVizCtxOrNull;

const horseAnimator = new HorseAnimator(ctx);
const allowedWeather = new Set(['SAULETA', 'LIETINGA', 'SNIEGAS', 'ZAIBAS']);

function applyGlobalWeatherTheme(weather: string): void {
  const normalized = allowedWeather.has(weather) ? weather : 'SAULETA';
  document.documentElement.setAttribute('data-weather', normalized);
  document.body.setAttribute('data-weather', normalized);
}

function setCompileValidityState(isValid: boolean, result: CompileResult): void {
  const wasValid = compileIsValid;
  latestCompileResult = result;
  cachedTechnicalNoticeSignature = '';
  cachedTechnicalNoticeLines = null;
  compileIsValid = isValid;
  if (isValid) {
    technicalNoticeExpanded = false;
  }
  if (!isValid && wasValid) {
    horseAnimator.clearNoteParticles();
  }
  renderCompileNoticeRail();
  renderHorseCompileNotice();
}

function buildTechnicalCompileNoticeLines(): string[] {
  const result = latestCompileResult;
  const signature = JSON.stringify({
    mode: result?.mode ?? null,
    syntaxEngine: result?.syntaxEngine ?? null,
    success: result?.success ?? null,
    firstError: result?.errors?.[0] ?? null,
  });
  if (cachedTechnicalNoticeLines !== null && cachedTechnicalNoticeSignature === signature) {
    return cachedTechnicalNoticeLines;
  }
  const syntaxLine =
    result?.syntaxEngine === 'tree-sitter-wasm'
      ? 'Tree-sitter C# (WASM) sintaksės analizatorius aktyvus.'
      : 'WASM sintaksės analizatorius nepasiekiamas; taikoma atsarginė C# struktūros patikra.';
  const modeLine =
    result?.mode === 'wasm'
      ? 'Pilnas tikrinimo režimas (WASM komponentai pasiekiami).'
      : 'Atsarginis tikrinimo režimas (dalis WASM komponentų nepasiekiama).';
  const statusLine = result?.success ? 'Kodas sukompiliuotas.' : 'Kodas nesikompiliuoja.';
  const errorLine = result?.errors[0] ?? 'Nenurodyta.';
  cachedTechnicalNoticeSignature = signature;
  cachedTechnicalNoticeLines = [
    'KODAS NESIKOMPILIUOJA',
    '',
    '1) Sintaksės tikrinimas',
    syntaxLine,
    modeLine,
    '',
    '2) Struktūros patikra',
    'DanceRules klasė, skliaustai, enum nariai, AkiuSpalva().',
    '',
    '3) Individualios taisyklės',
    'gerasLangas turi būti >= tobulasLangas.',
    '',
    '4) Rezultatas',
    statusLine,
    '',
    '5) Klaida',
    errorLine,
  ];
  return cachedTechnicalNoticeLines;
}

function useDesktopCompileNoticeRail(): boolean {
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const hoverCapable = window.matchMedia('(hover: hover)').matches;
  return finePointer && hoverCapable && window.innerWidth >= COMPILE_NOTICE_RAIL_MIN_WIDTH_PX;
}

function shouldRenderWeatherCanvasTechnicalNoticePanel(): boolean {
  return !useDesktopCompileNoticeRail();
}

function renderCompileNoticeRail(): void {
  if (compileIsValid) {
    compileNoticeRailEl.hidden = true;
    compileNoticeToggleEl.setAttribute('aria-expanded', 'false');
    return;
  }

  const showRail = useDesktopCompileNoticeRail();
  compileNoticeRailEl.hidden = !showRail;
  compileNoticeToggleEl.setAttribute('aria-expanded', technicalNoticeExpanded ? 'true' : 'false');
  if (!showRail) {
    return;
  }
  const fullLines = buildTechnicalCompileNoticeLines();
  const compactLines = [fullLines[0] ?? 'KODAS NESIKOMPILIUOJA', 'DAR REIKIA PADIRBETI'];
  const linesToRender = technicalNoticeExpanded ? fullLines : compactLines;
  compileNoticeTextEl.textContent = linesToRender.join('\n');
}

function renderHorseCompileNotice(): void {
  if (compileIsValid) {
    horseCompileNoticeEl.hidden = true;
    horseCompileNoticeToggleEl.setAttribute('aria-expanded', 'false');
    return;
  }

  const showNotice = true;
  horseCompileNoticeEl.hidden = !showNotice;
  horseCompileNoticeToggleEl.setAttribute(
    'aria-expanded',
    technicalNoticeExpanded ? 'true' : 'false',
  );
  if (!showNotice) {
    return;
  }
  const fullLines = buildTechnicalCompileNoticeLines();
  const compactLines = [fullLines[0] ?? 'KODAS NESIKOMPILIUOJA', 'DAR REIKIA PADIRBETI'];
  const linesToRender = technicalNoticeExpanded ? fullLines : compactLines;
  horseCompileNoticeTextEl.textContent = linesToRender.join('\n');
}

function isPointerInsideTechnicalIcon(
  canvasEl: HTMLCanvasElement,
  iconHit: TechnicalNoticeIconHit | null,
  clientX: number,
  clientY: number,
): boolean {
  if (!iconHit) {
    return false;
  }
  const rect = canvasEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const dx = localX - iconHit.x;
  const dy = localY - iconHit.y;
  const tapRadius = iconHit.r + 6;
  return dx * dx + dy * dy <= tapRadius * tapRadius;
}

function setRules(next: DanceRules): void {
  rules = next;
  applyGlobalWeatherTheme(next.oroEfektas);
  renderPuzzleProgress();
}

function clampSolvedPuzzleCount(next: number): number {
  const normalized = Number.isFinite(next) ? Math.trunc(next) : 0;
  return Math.max(0, Math.min(CODE_PUZZLES.length, normalized));
}

function readSolvedPuzzleCount(): number {
  try {
    const raw = window.localStorage.getItem(PUZZLE_PROGRESS_STORAGE_KEY);
    if (raw === null) {
      return 0;
    }
    const parsed = Number.parseInt(raw, 10);
    return clampSolvedPuzzleCount(parsed);
  } catch {
    return 0;
  }
}

function writeSolvedPuzzleCount(next: number): void {
  persistedSolvedPuzzleCount = clampSolvedPuzzleCount(next);
  try {
    if (persistedSolvedPuzzleCount <= 0) {
      window.localStorage.removeItem(PUZZLE_PROGRESS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PUZZLE_PROGRESS_STORAGE_KEY, `${persistedSolvedPuzzleCount}`);
  } catch {
    // Ignore storage failures; mission progress still works in-memory.
  }
}

function readSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSoundMuted(next: boolean): void {
  try {
    if (next) {
      window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(SOUND_MUTED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures; mute still works for current session.
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatInlineCode(value: string): string {
  const parts = value.split(/`([^`]+)`/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) {
        return `<code>${escapeHtml(part)}</code>`;
      }
      return escapeHtml(part);
    })
    .join('');
}

function renderPuzzleProgress(): void {
  const progress = evaluatePuzzleProgress(rules, readEditorSource());
  const solvedCount = Math.max(progress.solvedCount, persistedSolvedPuzzleCount);
  if (solvedCount > persistedSolvedPuzzleCount) {
    writeSolvedPuzzleCount(solvedCount);
  }
  const nextPuzzle = CODE_PUZZLES[solvedCount] ?? null;
  puzzleProgressEl.textContent = `${solvedCount} / ${progress.totalCount}`;
  const allSolved = solvedCount >= progress.totalCount;
  templateRewardEl.hidden = !allSolved;
  templateLockNoteEl.hidden = allSolved;

  if (allSolved) {
    puzzleStoryEl.textContent = 'Visos misijos įvykdytos. Arklys pasiruošęs gimtadienio koncertui!';
    puzzleGoalEl.textContent = 'Dabar gali laisvai eksperimentuoti ir kurti savo versiją.';
    puzzleHintEl.textContent = 'Pabandyk kitą šabloną arba redaguok C# ranka.';
    puzzleDoneEl.hidden = false;
    return;
  }

  if (!nextPuzzle) {
    return;
  }

  puzzleStoryEl.innerHTML = `<span class="puzzle-label">${escapeHtml(nextPuzzle.titleLt)}:</span> ${escapeHtml(nextPuzzle.storyLt)}`;
  puzzleGoalEl.innerHTML = `<span class="puzzle-label">🎯 Tikslas:</span> ${escapeHtml(nextPuzzle.goalLt)}`;
  puzzleHintEl.innerHTML = `<span class="puzzle-label">💡 Užuomina:</span> ${formatInlineCode(nextPuzzle.hintLt)}`;
  puzzleDoneEl.hidden = true;
}

function wireAudioBootstrap(): void {
  audioBootstrapScope.disposeAll();
  if (audioRetryIntervalId !== null) {
    window.clearInterval(audioRetryIntervalId);
    audioRetryIntervalId = null;
  }

  const tryUnlock = (): void => {
    audio.unlock();
  };

  // Best-effort attempt on initial load.
  tryUnlock();

  // Retry while autoplay is active; if browser policy allows, audio starts
  // without waiting for explicit gameplay input.
  audioRetryIntervalId = window.setInterval(() => {
    if (!autoplayEnabled) {
      return;
    }
    if (audio.isUnlocked()) {
      return;
    }
    tryUnlock();
  }, 900);
  audioBootstrapScope.add(() => {
    if (audioRetryIntervalId !== null) {
      window.clearInterval(audioRetryIntervalId);
      audioRetryIntervalId = null;
    }
  });

  // Policy-safe recovery hooks for browsers that require any user gesture.
  audioBootstrapScope.add(
    bindAudioBootstrapBindings({
      win: window,
      doc: document,
      tryUnlock,
      onHidden: () => {
        audio.stopAllHolds();
        audio.suspend();
      },
      onVisible: () => {
        tryUnlock();
      },
    }),
  );
}

function teardownGame(): void {
  if (disposed) {
    return;
  }
  disposed = true;

  if (compileTimer !== null) {
    window.clearTimeout(compileTimer);
    compileTimer = null;
  }

  if (audioRetryIntervalId !== null) {
    window.clearInterval(audioRetryIntervalId);
    audioRetryIntervalId = null;
  }
  audioBootstrapScope.disposeAll();
  editorScope.disposeAll();
  inputScope.disposeAll();
  canvasScope.disposeAll();
  autoplayScope.disposeAll();
  windowLifecycleScope.disposeAll();
  templateScope.disposeAll();
  editorResizeScope.disposeAll();
  dangerZoneScope.disposeAll();

  if (loopRafId !== null) {
    window.cancelAnimationFrame(loopRafId);
    loopRafId = null;
  }

  activeHolds.clear();
  autoHeldLanes.clear();
  pendingSongBeats.clear();
  pressedLanes.clear();
  audio.stopAllHolds();
  audio.shutdown();
}

function shouldUseSimpleEditor(): boolean {
  const touchLike = window.matchMedia('(pointer: coarse)').matches;
  const narrowScreen = window.innerWidth <= 900;
  return touchLike || narrowScreen;
}

function mountSimpleEditor(): void {
  editorScope.disposeAll();
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
  let scrollSyncRafId: number | null = null;
  const syncOverlayScroll = (): void => {
    const fallbackTop = fallback.scrollTop;
    const lineMaxTop = Math.max(0, lines.scrollHeight - lines.clientHeight);
    const highlightMaxTop = Math.max(0, highlight.scrollHeight - highlight.clientHeight);
    lines.scrollTop = Math.min(fallbackTop, lineMaxTop);
    highlight.scrollTop = Math.min(fallbackTop, highlightMaxTop);
    highlight.scrollLeft = fallback.scrollLeft;
  };

  const syncLines = (): void => {
    lines.textContent = buildWrappedLineNumbers(
      fallback.value,
      estimateFallbackCharsPerVisualLine(fallback),
    );
    syncOverlayScroll();
  };

  const syncHighlight = (): void => {
    const normalizedSource = fallback.value.endsWith('\n') ? fallback.value : `${fallback.value}\n`;
    const overlaySource = `${normalizedSource}\u200b`;
    highlight.innerHTML = highlightCSharp(overlaySource);
  };

  wireFallbackCompiler(fallback, INITIAL_EDITOR_SOURCE, compiler, {
    setRules: (next) => {
      setRules(next);
    },
    setCompileValidity: (isValid, result) => {
      setCompileValidityState(isValid, result);
    },
  });

  readEditorSource = (): string => fallback.value;
  writeEditorSource = (next: string): void => {
    const normalized = ensureTrailingEmptyLine(next);
    fallback.value = normalized;
    persistEditorSource(normalized);
    syncLines();
    syncHighlight();
    fallback.dispatchEvent(new Event('input', { bubbles: true }));
  };

  if (pendingEditorSource && pendingEditorSource !== fallback.value) {
    writeEditorSource(pendingEditorSource);
  }

  syncLines();
  syncHighlight();
  tryAutoSizeEditorPanelForInitialLoad();
  growEditorPanelToFitFallbackContent(fallback);
  window.requestAnimationFrame(() => {
    stabilizeEditorPanelAutoSize(fallback);
  });
  syncLines();
  syncHighlight();
  const fallbackEventsAbort = new AbortController();
  const { signal } = fallbackEventsAbort;
  fallback.addEventListener(
    'input',
    () => {
      persistEditorSource(fallback.value);
      growEditorPanelToFitFallbackContent(fallback);
      syncLines();
      syncHighlight();
    },
    { signal },
  );
  fallback.addEventListener(
    'scroll',
    () => {
      if (scrollSyncRafId !== null) {
        return;
      }
      scrollSyncRafId = window.requestAnimationFrame(() => {
        scrollSyncRafId = null;
        syncOverlayScroll();
      });
    },
    { passive: true, signal },
  );
  editorScope.add(() => {
    fallbackEventsAbort.abort();
  });
  editorScope.add(() => {
    if (scrollSyncRafId !== null) {
      window.cancelAnimationFrame(scrollSyncRafId);
      scrollSyncRafId = null;
    }
  });
  editorScope.add(
    bindSimpleEditorResizeBindings({
      win: window,
      fallback,
      syncLines,
      ResizeObserverCtor: typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined,
    }),
  );
}

function wireTemplateButtons(): void {
  templateScope.disposeAll();
  document.querySelectorAll<HTMLButtonElement>('.template-btn').forEach((button) => {
    templateScope.add(
      bindElementClick(button, () => {
        const templateId = button.dataset.templateId;
        if (!templateId) {
          return;
        }

        const next = applyDanceRuleTemplate(readEditorSource(), templateId);
        if (next === readEditorSource()) {
          return;
        }

        writeEditorSource(next);
        document.querySelectorAll<HTMLButtonElement>('.template-btn').forEach((el) => {
          el.classList.toggle('active', el === button);
        });
      }),
    );
  });
}

function updateHud(score: number, streak: number, judgement: string): void {
  scoreEl.textContent = `${score}`;
  streakEl.textContent = `${streak}`;
  multiplierEl.textContent = `x${getMultiplier(streak)}`;
  judgementEl.textContent = judgement;
  fitHudValuesToBox();
}

function fitHudValueToBox(el: HTMLElement): void {
  let sizePx = HUD_VALUE_MAX_FONT_PX;
  el.style.fontSize = `${sizePx}px`;

  while (
    (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) &&
    sizePx > HUD_VALUE_MIN_FONT_PX
  ) {
    sizePx -= 0.5;
    el.style.fontSize = `${sizePx}px`;
  }
}

function fitHudValuesToBox(): void {
  fitHudValueToBox(scoreEl);
  fitHudValueToBox(streakEl);
  fitHudValueToBox(multiplierEl);
  fitHudValueToBox(judgementEl);
}

function fitToggleButtonLabelToBox(el: HTMLButtonElement): void {
  let sizePx = TOGGLE_LABEL_MAX_FONT_PX;
  el.style.fontSize = `${sizePx}px`;

  while (
    (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) &&
    sizePx > TOGGLE_LABEL_MIN_FONT_PX
  ) {
    sizePx -= 0.5;
    el.style.fontSize = `${sizePx}px`;
  }
}

function fitToggleButtonLabelsToBox(): void {
  fitToggleButtonLabelToBox(autoplayToggleEl);
  fitToggleButtonLabelToBox(muteToggleEl);
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
        const height = Math.max(2, Math.abs(endY - y));
        return `<div class="hold-tail hold-lane-${note.lane}" style="top:${top}%; height:${height}%"></div><div class="note note-lane-${note.lane} hold-head" style="top:${y}%; transform: translate(-50%, -50%) scale(${scale}); opacity:${opacity}"></div>`;
      }

      return `<div class="note note-lane-${note.lane}" style="top:${y}%; transform: translate(-50%, -50%) scale(${scale}); opacity:${opacity}"></div>`;
    })
    .join('');
  lastVisibleNoteCount = notes.length;

  const activeHoldMarkup = Array.from(activeHolds.values())
    .map((hold) => {
      const remainingSec = Math.max(0, hold.endSec - nowSec);
      const endY = computeNoteYPercent(remainingSec, leadSec, trailSec);
      const hitLine = 85;
      const top = Math.min(hitLine, endY);
      const height = Math.max(1.2, hitLine - top);
      return `<div class="hold-active hold-lane-${hold.lane}" style="top:${top}%; height:${height}%"></div>`;
    })
    .join('');

  const nextMarkup = pendingMarkup + activeHoldMarkup;
  if (nextMarkup !== lastLaneMarkup) {
    laneHighwayEl.innerHTML = nextMarkup;
    lastLaneMarkup = nextMarkup;
  }
}

function readJsHeapMb(): number | null {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  };
  const used = perf.memory?.usedJSHeapSize;
  if (typeof used !== 'number' || Number.isNaN(used)) {
    return null;
  }

  return used / (1024 * 1024);
}

function estimateLocalStorageBytes(): number {
  try {
    const storage = window.localStorage;
    let usedChars = 0;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) {
        continue;
      }
      const value = storage.getItem(key) ?? '';
      usedChars += key.length + value.length;
    }
    return usedChars * 2;
  } catch {
    return 0;
  }
}

function estimateRuntimeMemoryBytes(): number {
  const nowSec = performance.now() / 1000;
  const trackedBeats = engine.getBeatsInRange(nowSec - 8, nowSec + 8, true).length;
  const horseStats = horseAnimator.getRuntimeStats();
  const audioStats = audio.readRuntimeStats();
  const editorSourceChars = readEditorSource().length;
  const domNodeCount = document.getElementsByTagName('*').length;

  let bytes = 0;
  // Canvas backbuffers are usually RGBA (4 bytes per pixel).
  bytes += canvas.width * canvas.height * 4;
  bytes += weatherSceneCanvas.width * weatherSceneCanvas.height * 4;
  bytes += audioVisualizerEl.width * audioVisualizerEl.height * 4;
  // Core gameplay runtime objects (rough model).
  bytes += trackedBeats * 72;
  bytes += lastVisibleNoteCount * 96;
  bytes += activeHolds.size * 80;
  bytes += pendingSongBeats.size * 96;
  bytes += autoPlayedBeatIds.size * 16;
  bytes += songPlayedBeatIds.size * 16;
  bytes += autoHeldLanes.size * 16;
  bytes += pressedLanes.size * 16;
  bytes += keyHeldLanes.size * 16;
  bytes += horseStats.noteParticles * 112;
  bytes += (audioStats.activeTransientVoices + audioStats.activeHoldVoices) * 256;
  // Text/markup and persistent payloads.
  bytes += lastLaneMarkup.length * 2;
  bytes += editorSourceChars * 2;
  bytes += estimateLocalStorageBytes();
  // Coarse DOM allocation estimate.
  bytes += domNodeCount * 160;

  return Math.max(0, Math.round(bytes));
}

async function sampleMemoryText(): Promise<string> {
  const estimatedBytes = estimateRuntimeMemoryBytes();
  const estimatedMb = estimatedBytes / (1024 * 1024);
  const estimatedText = `${estimatedMb.toFixed(1)}MB (įvertis)`;

  const heapMb = readJsHeapMb();
  if (heapMb !== null) {
    return `${heapMb.toFixed(1)}MB (naršyklė), ${estimatedText}`;
  }

  const perf = performance as Performance & {
    measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
  };
  if (typeof perf.measureUserAgentSpecificMemory === 'function') {
    try {
      const result = await perf.measureUserAgentSpecificMemory();
      const mb = result.bytes / (1024 * 1024);
      if (!Number.isNaN(mb) && Number.isFinite(mb)) {
        return `${mb.toFixed(1)}MB (naršyklė), ${estimatedText}`;
      }
    } catch {
      // Ignore; we still provide a clear fallback label below.
    }
  }

  return estimatedText;
}

function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'neprieinama';
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

function summarizeEditorSourceValue(source: string): string {
  const normalized = source.replace(/\r\n/g, '\n').replace(/\n+$/g, '');
  const lineCount = normalized.length === 0 ? 0 : normalized.split('\n').length;
  return `eilučių skaičius: ${lineCount}`;
}

function formatOwnStorageValue(key: string, value: string | null): string {
  if (value === null) {
    return 'nėra';
  }
  if (key === EDITOR_SOURCE_STORAGE_KEY) {
    return summarizeEditorSourceValue(value);
  }
  if (value.length === 0) {
    return '(tuščia)';
  }
  return value;
}

function readLocalStorageDebugStats(): LocalStorageDebugStats {
  try {
    const storage = window.localStorage;
    const keyCount = storage.length;
    let usedChars = 0;
    for (let i = 0; i < keyCount; i += 1) {
      const key = storage.key(i);
      if (!key) {
        continue;
      }
      const value = storage.getItem(key) ?? '';
      usedChars += key.length + value.length;
    }
    const usedBytesApprox = usedChars * 2;

    const ownKeyValues = LOCAL_STORAGE_KEYS_USED.map((key) =>
      formatOwnStorageValue(key, storage.getItem(key)),
    );
    const ownPresentCount = ownKeyValues.reduce(
      (count, value) => (value === 'nėra' ? count : count + 1),
      0,
    );

    return {
      availability: 'prieinama',
      keyCount: `${keyCount}`,
      ownKeys: `${ownPresentCount}/${LOCAL_STORAGE_KEYS_USED.length}`,
      ownKeyValues,
      approxUsed: formatStorageBytes(usedBytesApprox),
      browserStorage: 'neprieinama',
    };
  } catch (error) {
    const reason = error instanceof Error && error.message ? error.message : 'klaida';
    return {
      availability: `neprieinama (${reason})`,
      keyCount: 'neprieinama',
      ownKeys: 'neprieinama',
      ownKeyValues: LOCAL_STORAGE_KEYS_USED.map(() => 'neprieinama'),
      approxUsed: 'neprieinama',
      browserStorage: 'neprieinama',
    };
  }
}

async function sampleLocalStorageStats(): Promise<LocalStorageDebugStats> {
  const stats = readLocalStorageDebugStats();
  const navigatorWithStorage = navigator as Navigator & {
    storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> };
  };
  const estimateFn = navigatorWithStorage.storage?.estimate;
  if (typeof estimateFn !== 'function') {
    return stats;
  }

  try {
    const estimate = await estimateFn.call(navigatorWithStorage.storage);
    const usage =
      typeof estimate.usage === 'number' ? formatStorageBytes(estimate.usage) : 'neprieinama';
    const quota =
      typeof estimate.quota === 'number' ? formatStorageBytes(estimate.quota) : 'neprieinama';
    stats.browserStorage = `${usage} / ${quota}`;
  } catch {
    stats.browserStorage = 'neprieinama';
  }

  return stats;
}

function queuePerformanceSamples(nowMs: number): void {
  if (!perfStackEl.open) {
    return;
  }
  if (perfMemorySampleInFlight) {
    return;
  }
  if (nowMs - perfLastMemorySampleMs < 5000) {
    return;
  }

  perfLastMemorySampleMs = nowMs;
  perfMemorySampleInFlight = true;
  void Promise.all([sampleMemoryText(), sampleLocalStorageStats()])
    .then(([nextMemory, nextStorage]) => {
      perfMemoryText = nextMemory;
      perfLocalStorageStats = nextStorage;
    })
    .finally(() => {
      perfMemorySampleInFlight = false;
    });
}

function formatStatValue(value: string): string {
  if (value.trim() === 'tikrinama...') {
    return '<span class="perf-stats-placeholder"><span class="perf-stats-placeholder-dot" aria-hidden="true"></span><span class="perf-stats-placeholder-text">tikrinama...</span></span>';
  }
  return escapeHtml(value);
}

function isMobilePerformanceMode(): boolean {
  return IS_COARSE_POINTER && window.innerWidth <= MOBILE_PERF_MAX_WIDTH_PX;
}

function summarizeRepoBloatSignal(stats: BuildGitRepoStats): string {
  if (!stats.available) {
    return 'neprieinama';
  }
  const churnBytes = stats.historyChurn.reduce((sum, entry) => sum + entry.totalBytes, 0);
  if (stats.gitDirBytes < 10 * 1024 * 1024 && churnBytes < 5 * 1024 * 1024) {
    return 'žemas';
  }
  if (stats.gitDirBytes < 30 * 1024 * 1024 && churnBytes < 15 * 1024 * 1024) {
    return 'vidutinis';
  }
  return 'aukštas';
}

function buildGitDiagnosticsLines(): string[] {
  const stats = __GIT_REPO_STATS__;
  if (!stats.available) {
    return [
      'Git (repo): neprieinama',
      `Git klaida: ${stats.error ?? 'nežinoma'}`,
      'Repo bloat signalas: neprieinama',
    ];
  }

  const lines = [
    `Git šaka: ${stats.branch}`,
    `Git commit: ${stats.commit}`,
    `Sekami failai: ${stats.trackedFileCount}`,
    `Git metaduomenų dydis (.git): ${formatStorageBytes(stats.gitDirBytes)}`,
    `Git objektų kiekis: ${stats.gitObjectCount ?? 'neprieinama'}`,
    `Git objektų vieta (loose/pack): ${stats.gitLooseSizeBytes === null || stats.gitPackSizeBytes === null ? 'neprieinama' : `${formatStorageBytes(stats.gitLooseSizeBytes)} / ${formatStorageBytes(stats.gitPackSizeBytes)}`}`,
    'Didžiausi sekami failai (dabar):',
    ...stats.largestTrackedFiles.map(
      (entry) => `  - ${entry.path}=${formatStorageBytes(entry.bytes)}`,
    ),
    'Didžiausias istorijos churn (per blob versijas):',
    ...stats.historyChurn.map(
      (entry) =>
        `  - ${entry.path}=${formatStorageBytes(entry.totalBytes)} per ${entry.blobCount} blob vers.`,
    ),
    `Repo bloat signalas: ${summarizeRepoBloatSignal(stats)}`,
  ];

  return lines;
}

function renderPerformanceStatsPanel(
  fpsText: string,
  frameTimeText: string,
  noteCountText: string,
  particleCountText: string,
  activeTransientVoicesText: string,
  activeHoldVoicesText: string,
  visualCapText: string,
): void {
  const perfLines = [
    `Našumas: ${fpsText}`,
    `Kadro laikas: ${frameTimeText}`,
    `Atmintis: ${perfMemoryText}`,
    `Natos: ${noteCountText}`,
    `Dalelės: ${particleCountText}`,
    `Garso balsai: ${activeTransientVoicesText}`,
    `Laikomos natos: ${activeHoldVoicesText}`,
    `Vizualo riba: ${visualCapText}`,
    `Vietinė saugykla: ${perfLocalStorageStats.availability}`,
    `Raktų kiekis: ${perfLocalStorageStats.keyCount}`,
    `Mūsų raktai: ${perfLocalStorageStats.ownKeys}`,
    'Mūsų raktų būsena:',
    ...LOCAL_STORAGE_KEYS_USED.map((key, index) => {
      const value = perfLocalStorageStats.ownKeyValues[index] ?? 'tikrinama...';
      return `  - ${key}=${value}`;
    }),
    `Užimta (apytiksliai): ${perfLocalStorageStats.approxUsed}`,
    `Naršyklės saugykla: ${perfLocalStorageStats.browserStorage}`,
    'Git diagnostika:',
    ...buildGitDiagnosticsLines(),
  ];
  const formatStatLine = (line: string): string => {
    if (line.startsWith('  - ')) {
      const entry = line.slice(4);
      const equalsIndex = entry.indexOf('=');
      if (equalsIndex === -1) {
        return `&nbsp;&nbsp;- <strong>${escapeHtml(entry)}</strong>`;
      }
      const key = entry.slice(0, equalsIndex);
      const value = entry.slice(equalsIndex + 1);
      return `&nbsp;&nbsp;- <strong>${escapeHtml(key)}</strong>=${formatStatValue(value)}`;
    }
    const labelEnd = line.indexOf(':');
    if (labelEnd <= 0) {
      return escapeHtml(line);
    }
    const label = line.slice(0, labelEnd);
    const value = line.slice(labelEnd + 1);
    return `<strong>${escapeHtml(label)}:</strong>${formatStatValue(value)}`;
  };
  const statLines = perfLines.map((line) => formatStatLine(line));
  const creditsLine = escapeHtml(FOOTER_CREDITS_LINE);
  perfStatsEl.innerHTML = `<br>${statLines.join('<br>')}<br><strong>GitHub:</strong> <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${REPO_URL}</a><br><br>${creditsLine}`;
}

function updatePerformanceStats(nowMs: number): void {
  perfFrameCount += 1;
  if (lastFrameTimeMs !== null) {
    perfFrameMsTotal += Math.max(0, nowMs - lastFrameTimeMs);
  }
  lastFrameTimeMs = nowMs;

  const windowMs = nowMs - perfWindowStartMs;
  if (windowMs < 900) {
    return;
  }
  queuePerformanceSamples(nowMs);

  const fps = perfFrameCount / (windowMs / 1000);
  const avgFrameMs = perfFrameCount > 0 ? perfFrameMsTotal / perfFrameCount : 0;
  latestMeasuredFps = fps;
  latestMeasuredFrameMs = avgFrameMs;
  if (!perfStackEl.open) {
    perfWindowStartMs = nowMs;
    perfFrameCount = 0;
    perfFrameMsTotal = 0;
    return;
  }
  const audioStats = audio.readRuntimeStats();
  const horseStats = horseAnimator.getRuntimeStats();
  const visualCap = isMobilePerformanceMode() ? (autoplayEnabled ? 36 : 45) : 60;
  renderPerformanceStatsPanel(
    `${fps.toFixed(1)} kadr./s`,
    `${avgFrameMs.toFixed(1)} ms`,
    `${lastVisibleNoteCount}`,
    `${horseStats.noteParticles}`,
    `${audioStats.activeTransientVoices}`,
    `${audioStats.activeHoldVoices}`,
    `${visualCap} kadr./s`,
  );

  perfWindowStartMs = nowMs;
  perfFrameCount = 0;
  perfFrameMsTotal = 0;
}

renderPerformanceStatsPanel(
  'tikrinama...',
  'tikrinama...',
  'tikrinama...',
  'tikrinama...',
  'tikrinama...',
  'tikrinama...',
  `${isMobilePerformanceMode() ? 36 : 60} kadr./s`,
);

function renderAutoplayUiState(): void {
  autoplayToggleEl.innerHTML = `<span class="toggle-label">Žaisti automatiškai:</span> <span class="toggle-state ${autoplayEnabled ? 'on' : 'off'}">${autoplayEnabled ? 'TAIP' : 'NE'}</span>`;
  autoplayOverlayEl.classList.toggle('show', autoplayEnabled);
  fitToggleButtonLabelsToBox();
}

function renderSoundUiState(): void {
  const soundOn = !soundMuted;
  muteToggleEl.innerHTML = `<span class="toggle-label">Garsas:</span> <span class="toggle-state ${soundOn ? 'on' : 'off'}">${soundOn ? 'ĮJUNGTAS' : 'IŠJUNGTAS'}</span>`;
  fitToggleButtonLabelsToBox();
}

function shouldRenderFrameWithCadence(
  timeMs: number,
  lastRenderMs: number,
  targetFps: number,
): number | null {
  const minFrameIntervalMs = 1000 / targetFps;
  const elapsedMs = timeMs - lastRenderMs;
  if (elapsedMs + 0.4 < minFrameIntervalMs) {
    return null;
  }
  if (lastRenderMs <= 0 || elapsedMs > minFrameIntervalMs * 2.5) {
    return timeMs;
  }
  return lastRenderMs + minFrameIntervalMs;
}

function shouldRenderVisualFrame(timeMs: number): boolean {
  if (!isMobilePerformanceMode()) {
    lastVisualRenderMs = timeMs;
    return true;
  }
  const targetVisualFps = autoplayEnabled ? 36 : 45;
  const nextRenderMs = shouldRenderFrameWithCadence(timeMs, lastVisualRenderMs, targetVisualFps);
  if (nextRenderMs === null) {
    return false;
  }
  lastVisualRenderMs = nextRenderMs;
  return true;
}

function shouldRenderWeatherSceneFrame(timeMs: number): boolean {
  const targetWeatherFps = isMobilePerformanceMode()
    ? WEATHER_VISUAL_FPS_COARSE
    : WEATHER_VISUAL_FPS_FINE;
  const nextRenderMs = shouldRenderFrameWithCadence(timeMs, lastWeatherRenderMs, targetWeatherFps);
  if (nextRenderMs === null) {
    return false;
  }
  lastWeatherRenderMs = nextRenderMs;
  return true;
}

function shouldRenderAudioVisualizerFrame(timeMs: number): boolean {
  const targetAudioVizFps = isMobilePerformanceMode() ? AUDIO_VIZ_FPS_COARSE : AUDIO_VIZ_FPS_FINE;
  const nextRenderMs = shouldRenderFrameWithCadence(
    timeMs,
    lastAudioVizRenderMs,
    targetAudioVizFps,
  );
  if (nextRenderMs === null) {
    return false;
  }
  lastAudioVizRenderMs = nextRenderMs;
  return true;
}

function shouldRenderHorseFrame(timeMs: number): boolean {
  const targetHorseFps = isMobilePerformanceMode()
    ? HORSE_VISUAL_FPS_COARSE
    : HORSE_VISUAL_FPS_FINE;
  const nextRenderMs = shouldRenderFrameWithCadence(timeMs, lastHorseRenderMs, targetHorseFps);
  if (nextRenderMs === null) {
    return false;
  }
  lastHorseRenderMs = nextRenderMs;
  return true;
}

function shouldRenderLaneFrame(timeMs: number): boolean {
  const targetLaneFps = isMobilePerformanceMode() ? LANE_VISUAL_FPS_COARSE : LANE_VISUAL_FPS_FINE;
  const nextRenderMs = shouldRenderFrameWithCadence(timeMs, lastLaneRenderMs, targetLaneFps);
  if (nextRenderMs === null) {
    return false;
  }
  lastLaneRenderMs = nextRenderMs;
  return true;
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
    }
  }
}

function resizeCanvas(): void {
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  const isCoarseLandscape = IS_COARSE_POINTER && isLandscape;
  const cardStyle = window.getComputedStyle(gameScreen);
  const horizontalPadding =
    Number.parseFloat(cardStyle.paddingLeft) + Number.parseFloat(cardStyle.paddingRight);
  const containerWidth = Math.floor(gameScreen.clientWidth - horizontalPadding);
  const fallbackWidth = Math.floor(window.innerWidth - 24);
  const availableWidth = containerWidth > 0 ? containerWidth : fallbackWidth;
  const horseWidth = Math.max(220, availableWidth);
  const horseHeight = isCoarseLandscape
    ? Math.min(140, Math.max(92, Math.floor(window.innerHeight * 0.16)))
    : Math.min(170, Math.max(120, Math.floor(window.innerHeight * 0.2)));
  const metrics = buildLayoutMetrics(horseWidth, horseHeight, window.devicePixelRatio || 1);
  canvas.style.width = `${metrics.width}px`;
  canvas.style.height = `${metrics.height}px`;
  canvas.width = metrics.canvasWidth;
  canvas.height = metrics.canvasHeight;
  ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);

  const sceneCssWidth = Math.max(1, Math.floor(window.innerWidth));
  const sceneCssHeight = Math.max(1, Math.floor(window.innerHeight));
  const nativeSceneDpr = window.devicePixelRatio || 1;
  const scenePixelLimitScale = Math.sqrt(
    WEATHER_SCENE_MAX_PIXELS / Math.max(1, sceneCssWidth * sceneCssHeight),
  );
  const sceneDprCap = Number.isFinite(scenePixelLimitScale)
    ? scenePixelLimitScale
    : WEATHER_SCENE_MAX_DPR;
  const sceneDpr = Math.max(0.85, Math.min(nativeSceneDpr, WEATHER_SCENE_MAX_DPR, sceneDprCap));
  weatherSceneCanvas.style.width = `${sceneCssWidth}px`;
  weatherSceneCanvas.style.height = `${sceneCssHeight}px`;
  weatherSceneCanvas.width = Math.floor(sceneCssWidth * sceneDpr);
  weatherSceneCanvas.height = Math.floor(sceneCssHeight * sceneDpr);
  weatherSceneDpr = sceneDpr;
  weatherSceneCtx.setTransform(sceneDpr, 0, 0, sceneDpr, 0, 0);
  renderBackgroundWeatherScene(
    performance.now() / 1000,
    latestVisualizerBars,
    compileIsValid ? [] : buildTechnicalCompileNoticeLines(),
  );
  renderCompileNoticeRail();
  renderHorseCompileNotice();

  fitHudValuesToBox();
  fitToggleButtonLabelsToBox();
  resizeAudioVisualizer();
}

function stabilizeCanvasSizing(remainingFrames = 8): void {
  if (canvasStabilizeRafId !== null) {
    window.cancelAnimationFrame(canvasStabilizeRafId);
    canvasStabilizeRafId = null;
  }

  resizeCanvas();
  if (remainingFrames <= 0) {
    return;
  }

  canvasStabilizeRafId = window.requestAnimationFrame(() => {
    stabilizeCanvasSizing(remainingFrames - 1);
  });
}

stabilizeCanvasSizing();
renderBackgroundWeatherScene(
  performance.now() / 1000,
  latestVisualizerBars,
  compileIsValid ? [] : buildTechnicalCompileNoticeLines(),
);
function resizeAudioVisualizer(): void {
  const cssWidth = Math.max(180, Math.floor(audioVisualizerEl.clientWidth));
  const cssHeight = 54;
  const dpr = window.devicePixelRatio || 1;
  audioVisualizerEl.width = Math.floor(cssWidth * dpr);
  audioVisualizerEl.height = Math.floor(cssHeight * dpr);
  audioVizCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function renderAudioVisualizer(snapshot?: { bars: number[] }): void {
  if (!perfStackEl.open) {
    return;
  }
  const width = Math.max(1, Math.floor(audioVisualizerEl.width / (window.devicePixelRatio || 1)));
  const height = Math.max(1, Math.floor(audioVisualizerEl.height / (window.devicePixelRatio || 1)));
  const visualizerSnapshot = snapshot ?? audio.sampleVisualizer(52);
  const { bars } = visualizerSnapshot;
  const gap = 1;
  const horizontalInset = 2;
  const innerWidth = Math.max(1, width - horizontalInset * 2);
  const barWidth = Math.max(1, Math.floor((innerWidth - (bars.length - 1) * gap) / bars.length));
  const contentWidth = bars.length * barWidth + (bars.length - 1) * gap;
  const startX = horizontalInset + Math.max(0, Math.floor((innerWidth - contentWidth) / 2));
  if (startX !== lastPerfStatsIndentPx) {
    lastPerfStatsIndentPx = startX;
    perfStatsEl.style.paddingLeft = `${startX}px`;
  }

  audioVizCtx.clearRect(0, 0, width, height);
  audioVizCtx.fillStyle = 'rgba(255, 245, 226, 0.85)';
  audioVizCtx.fillRect(0, 0, width, height);

  const baseY = height - 4;
  const usableHeight = height - 10;
  for (let i = 0; i < bars.length; i += 1) {
    const x = startX + i * (barWidth + gap);
    const barHeight = Math.max(2, Math.floor(usableHeight * bars[i]));
    const hue = 28 + Math.round(bars[i] * 16);
    audioVizCtx.fillStyle = `hsl(${hue}deg 90% 45%)`;
    audioVizCtx.fillRect(x, baseY - barHeight, barWidth, barHeight);
  }
}

function renderBackgroundWeatherScene(
  nowSec: number,
  technicalWaveformBars: readonly number[],
  technicalNoticeLines: readonly string[],
): void {
  const sceneWidth = Math.max(
    1,
    Math.floor(weatherSceneCanvas.width / Math.max(0.01, weatherSceneDpr)),
  );
  const sceneHeight = Math.max(
    1,
    Math.floor(weatherSceneCanvas.height / Math.max(0.01, weatherSceneDpr)),
  );
  const sceneMode: WeatherSceneRenderMode = compileIsValid ? 'normal' : 'technical-test';
  const showTechnicalNoticePanel = shouldRenderWeatherCanvasTechnicalNoticePanel();
  const iconHit: TechnicalNoticeIconHit | null =
    sceneMode === 'technical-test' && showTechnicalNoticePanel ? { x: 0, y: 0, r: 0 } : null;
  renderWeatherScene(
    weatherSceneCtx,
    nowSec,
    sceneWidth,
    sceneHeight,
    rules,
    sceneMode,
    technicalWaveformBars,
    technicalNoticeLines,
    technicalNoticeExpanded,
    iconHit,
    showTechnicalNoticePanel,
  );
  weatherTechnicalNoticeIconHit = iconHit;
}
function wireCanvasResize(): void {
  canvasScope.disposeAll();
  canvasScope.add(bindWindowResize(window, () => stabilizeCanvasSizing()));
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      stabilizeCanvasSizing(4);
    });
    observer.observe(gameScreen);
    canvasScope.add(() => {
      observer.disconnect();
    });
  }
  canvasScope.add(() => {
    if (canvasStabilizeRafId !== null) {
      window.cancelAnimationFrame(canvasStabilizeRafId);
      canvasStabilizeRafId = null;
    }
  });
}

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
    if (compileIsValid) {
      horseAnimator.emitPerfectNotes(lane);
    }
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
  if (source === 'manual') {
    audio.onPress(lane);
  }

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
    const current = state.getState().score;
    const keepHypeStatus = current.hypeActive;
    mood = keepHypeStatus ? 'UZSIVEDIMAS' : 'GERAI';
    updateHud(current.score, current.streak, keepHypeStatus ? HYPE_LABEL : 'LAIKYK');
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

function trimSetOldest(set: Set<number>, maxSize: number): void {
  while (set.size > maxSize) {
    const first = set.values().next();
    if (first.done) {
      break;
    }
    set.delete(first.value);
  }
}

function prunePlayedBeatTracking(nowSec: number): void {
  const activeWindow = engine.getBeatsInRange(nowSec - 3, nowSec + 8, true);
  if (activeWindow.length === 0) {
    if (autoPlayedBeatIds.size > MAX_TRACKED_AUTO_PLAYED_BEATS) {
      autoPlayedBeatIds.clear();
    }
    if (songPlayedBeatIds.size > MAX_TRACKED_SONG_PLAYED_BEATS) {
      songPlayedBeatIds.clear();
    }
    return;
  }

  let minId = activeWindow[0].id;
  for (let i = 1; i < activeWindow.length; i += 1) {
    minId = Math.min(minId, activeWindow[i].id);
  }

  const keepFromId = minId - 16;
  for (const id of autoPlayedBeatIds) {
    if (id < keepFromId) {
      autoPlayedBeatIds.delete(id);
    }
  }
  for (const id of songPlayedBeatIds) {
    if (id < keepFromId) {
      songPlayedBeatIds.delete(id);
    }
  }

  trimSetOldest(autoPlayedBeatIds, MAX_TRACKED_AUTO_PLAYED_BEATS);
  trimSetOldest(songPlayedBeatIds, MAX_TRACKED_SONG_PLAYED_BEATS);
}

function startLoop(): void {
  let prevNowSec: number | null = null;

  const tick = (timeMs: number): void => {
    if (disposed) {
      return;
    }
    const now = timeMs / 1000;
    const frameDeltaSec =
      prevNowSec === null ? 1 / 60 : Math.max(1 / 240, Math.min(0.5, now - prevNowSec));
    prevNowSec = now;
    engine.update(now);
    if (autoplayEnabled) {
      const autoWindowSec = Math.max(0.02, rules.tobulasLangas * 0.75, frameDeltaSec * 1.35);
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

    const songLookBehindSec = Math.max(0.18, frameDeltaSec * 2.2);
    const songLookAheadSec = Math.max(0.06, frameDeltaSec * 0.65);
    const songNotes = engine.getBeatsInRange(now - songLookBehindSec, now + songLookAheadSec, true);
    const audioUnlocked = audio.isUnlocked();
    const playbackPlan = planSongPlaybackBatch({
      nowSec: now,
      unlocked: audioUnlocked,
      windowBeats: songNotes,
      pendingBeats: Array.from(pendingSongBeats.values()),
      playedBeatIds: songPlayedBeatIds,
      maxPendingAgeSec: 1.2,
      maxPendingCount: 24,
    });
    pendingSongBeats.clear();
    for (const beat of playbackPlan.pending) {
      pendingSongBeats.set(beat.id, beat);
    }
    if (!audioUnlocked && playbackPlan.pending.length > 0) {
      audio.unlock();
    }
    for (const beat of playbackPlan.toPlay) {
      if (songPlayedBeatIds.has(beat.id)) {
        continue;
      }
      songPlayedBeatIds.add(beat.id);
      audio.playSongGuideNote(beat.toneHz, beat.holdDurationSec);
      audio.playSongBacking(beat.toneHz, beat.holdDurationSec);
    }
    prunePlayedBeatTracking(now);

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
    if (shouldRenderVisualFrame(timeMs)) {
      const visualizerSnapshot = audio.sampleVisualizer(52);
      latestVisualizerBars = visualizerSnapshot.bars;
      const technicalNoticeLines = compileIsValid ? [] : buildTechnicalCompileNoticeLines();
      if (shouldRenderWeatherSceneFrame(timeMs)) {
        renderBackgroundWeatherScene(now, latestVisualizerBars, technicalNoticeLines);
      }
      if (shouldRenderLaneFrame(timeMs)) {
        renderLanes(now);
      }
      if (shouldRenderHorseFrame(timeMs)) {
        const visualMood: HorseMood = compileIsValid ? mood : 'MIEGA';
        const visualHasHold = compileIsValid && activeHolds.size > 0;
        const holdingLane = visualHasHold
          ? (activeHolds.values().next().value?.lane ?? null)
          : null;
        const sceneMode: WeatherSceneRenderMode = compileIsValid ? 'normal' : 'technical-test';
        horseAnimator.render(
          timeMs,
          visualMood,
          rules,
          visualHasHold,
          holdingLane,
          sceneMode,
          latestVisualizerBars,
          technicalNoticeLines,
          technicalNoticeExpanded,
          false,
        );
      }
      if (shouldRenderAudioVisualizerFrame(timeMs)) {
        renderAudioVisualizer(visualizerSnapshot);
      }
      updatePerformanceStats(timeMs);
    }
    loopRafId = requestAnimationFrame(tick);
  };

  loopRafId = requestAnimationFrame(tick);
}

async function initEditor(): Promise<void> {
  const onCodeStudioToggle = (): void => {
    if (!codeStudioEl.open) {
      return;
    }
    window.requestAnimationFrame(() => {
      tryAutoSizeEditorPanelForInitialLoad();
      const fallback = document.querySelector<HTMLTextAreaElement>('#fallbackCode');
      if (fallback) {
        growEditorPanelToFitFallbackContent(fallback);
        window.requestAnimationFrame(() => {
          stabilizeEditorPanelAutoSize(fallback);
        });
      }
      window.dispatchEvent(new Event('resize'));
    });
  };
  codeStudioEl.addEventListener('toggle', onCodeStudioToggle);
  editorScope.add(() => {
    codeStudioEl.removeEventListener('toggle', onCodeStudioToggle);
  });

  if (shouldUseSimpleEditor()) {
    mountSimpleEditor();
    return;
  }

  try {
    const editor = await mountMonacoEditor(editorHost, INITIAL_EDITOR_SOURCE);
    tryAutoSizeEditorPanelForInitialLoad();

    const compileApplier = createLatestCompileApplier(compiler, {
      setRules: (next) => {
        setRules(next);
      },
      setCompileValidity: (isValid, result) => {
        setCompileValidityState(isValid, result);
      },
    });

    const runCompile = (): void => {
      void compileApplier.apply(editor.getValue());
    };

    editor.onDidChangeModelContent(() => {
      persistEditorSource(editor.getValue());
      if (compileTimer !== null) {
        window.clearTimeout(compileTimer);
      }
      compileTimer = window.setTimeout(runCompile, 150);
    });

    readEditorSource = (): string => editor.getValue();
    writeEditorSource = (next: string): void => {
      const normalized = ensureTrailingEmptyLine(next);
      editor.setValue(normalized);
      persistEditorSource(normalized);
      if (compileTimer !== null) {
        window.clearTimeout(compileTimer);
      }
      runCompile();
    };

    if (pendingEditorSource && pendingEditorSource !== editor.getValue()) {
      writeEditorSource(pendingEditorSource);
    }

    runCompile();
  } catch {
    mountSimpleEditor();
  }
}

function wireInputs(): void {
  inputScope.disposeAll();
  const abortController = new AbortController();
  const { signal } = abortController;

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

  const releasePointerLane = (lane: number): void => {
    if (!pressedLanes.has(lane)) {
      return;
    }
    if (keyHeldLanes.has(lane)) {
      return;
    }

    pressedLanes.delete(lane);
    releaseLanePress(performance.now() / 1000, lane);
  };

  const toggleTechnicalNoticeOnCanvasPointer = (
    canvasEl: HTMLCanvasElement,
    iconHit: TechnicalNoticeIconHit | null,
    event: PointerEvent,
  ): void => {
    if (compileIsValid) {
      return;
    }
    if (!isPointerInsideTechnicalIcon(canvasEl, iconHit, event.clientX, event.clientY)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    technicalNoticeExpanded = !technicalNoticeExpanded;
    renderCompileNoticeRail();
    renderHorseCompileNotice();
  };

  compileNoticeToggleEl.addEventListener(
    'click',
    () => {
      if (compileIsValid) {
        return;
      }
      technicalNoticeExpanded = !technicalNoticeExpanded;
      renderCompileNoticeRail();
      renderHorseCompileNotice();
    },
    { signal },
  );

  horseCompileNoticeToggleEl.addEventListener(
    'click',
    () => {
      if (compileIsValid) {
        return;
      }
      technicalNoticeExpanded = !technicalNoticeExpanded;
      renderCompileNoticeRail();
      renderHorseCompileNotice();
    },
    { signal },
  );

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      toggleTechnicalNoticeOnCanvasPointer(
        canvas,
        horseAnimator.getTechnicalNoticeIconHit(),
        event,
      );
    },
    { signal },
  );

  weatherSceneCanvas.addEventListener(
    'pointerdown',
    (event) => {
      toggleTechnicalNoticeOnCanvasPointer(
        weatherSceneCanvas,
        weatherTechnicalNoticeIconHit,
        event,
      );
    },
    { signal },
  );

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
      { passive: false, signal },
    );

    button.addEventListener(
      'touchend',
      () => {
        releasePointerLane(lane);
      },
      { signal },
    );

    button.addEventListener(
      'touchcancel',
      () => {
        releasePointerLane(lane);
      },
      { signal },
    );

    button.addEventListener(
      'mousedown',
      () => {
        audio.unlock();
        if (pressedLanes.has(lane)) {
          return;
        }
        pressedLanes.add(lane);
        pulseLaneButton(lane);
        startLanePress(performance.now() / 1000, lane);
      },
      { signal },
    );

    button.addEventListener(
      'mouseup',
      () => {
        releasePointerLane(lane);
      },
      { signal },
    );

    button.addEventListener(
      'mouseleave',
      () => {
        releasePointerLane(lane);
      },
      { signal },
    );
  });

  window.addEventListener(
    'mouseup',
    () => {
      const now = performance.now() / 1000;
      for (const lane of Array.from(pressedLanes)) {
        if (keyHeldLanes.has(lane)) {
          continue;
        }
        pressedLanes.delete(lane);
        releaseLanePress(now, lane);
      }
    },
    { signal },
  );

  window.addEventListener(
    'keydown',
    (event) => {
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
      keyHeldLanes.add(lane);
      pressedLanes.add(lane);
      pulseLaneButton(lane);
      startLanePress(performance.now() / 1000, lane);
    },
    { signal },
  );

  window.addEventListener(
    'keyup',
    (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const lane = normalizeLaneFromKey(event.key);
      if (lane === null) {
        return;
      }

      keyHeldLanes.delete(lane);
      if (!pressedLanes.has(lane)) {
        return;
      }
      pressedLanes.delete(lane);
      releaseLanePress(performance.now() / 1000, lane);
    },
    { signal },
  );

  inputScope.add(() => {
    abortController.abort();
  });
}

function wireHudToggles(): void {
  autoplayScope.disposeAll();
  const onAutoplayToggle = (): void => {
    audio.unlock();
    autoplayEnabled = !autoplayEnabled;
    renderAutoplayUiState();
  };
  const onMuteToggle = (): void => {
    soundMuted = !soundMuted;
    audio.setMuted(soundMuted);
    writeSoundMuted(soundMuted);
    renderSoundUiState();
  };
  autoplayScope.add(bindElementClick(autoplayToggleEl, onAutoplayToggle));
  autoplayScope.add(bindElementClick(muteToggleEl, onMuteToggle));
}

function closeResetProgressDialog(): void {
  resetProgressConfirmInputEl.value = '';
  resetProgressConfirmButtonEl.disabled = true;
  if (resetProgressDialogEl.open) {
    resetProgressDialogEl.close();
  }
}

function closeUnlockAllMissionsDialog(): void {
  unlockAllMissionsConfirmInputEl.value = '';
  unlockAllMissionsConfirmButtonEl.disabled = true;
  if (unlockAllMissionsDialogEl.open) {
    unlockAllMissionsDialogEl.close();
  }
}

function closeResetCodeDialog(): void {
  resetCodeConfirmInputEl.value = '';
  resetCodeConfirmButtonEl.disabled = true;
  if (resetCodeDialogEl.open) {
    resetCodeDialogEl.close();
  }
}

async function isValidUnlockMissionsCode(input: string): Promise<boolean> {
  const normalizedInput = input.trim();
  if (normalizedInput.length === 0 || typeof crypto?.subtle?.digest !== 'function') {
    return false;
  }

  const encoded = new TextEncoder().encode(normalizedInput);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const digestHex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return digestHex === UNLOCK_MISSIONS_CODE_HASH_SHA256;
}

function unlockAllMissionsProgress(): void {
  writeSolvedPuzzleCount(CODE_PUZZLES.length);
  renderPuzzleProgress();
}

function resetEditorCodeToDefault(): void {
  const storage = readBrowserLocalStorageOrNull();
  if (storage) {
    clearPersistedEditorSource(storage);
  }
  writeEditorSource(CSHARP_TEMPLATE);
  document.querySelectorAll<HTMLButtonElement>('.template-btn').forEach((el) => {
    el.classList.remove('active');
  });
  renderPuzzleProgress();
}

function resetGameProgressToDefaults(): void {
  writeSolvedPuzzleCount(0);
  soundMuted = false;
  audio.setMuted(false);
  writeSoundMuted(false);
  autoplayEnabled = true;
  renderAutoplayUiState();
  renderSoundUiState();
  state.resetRun();
  updateHud(0, 0, 'PRALEISTA');
  mood = 'GERAI';
  resetEditorCodeToDefault();
}

function wireDangerZone(): void {
  dangerZoneScope.disposeAll();
  const supportsUnlockAllMissionsModalDialog =
    typeof unlockAllMissionsDialogEl.showModal === 'function' &&
    typeof unlockAllMissionsDialogEl.close === 'function';
  const supportsProgressModalDialog =
    typeof resetProgressDialogEl.showModal === 'function' &&
    typeof resetProgressDialogEl.close === 'function';
  const supportsCodeModalDialog =
    typeof resetCodeDialogEl.showModal === 'function' &&
    typeof resetCodeDialogEl.close === 'function';

  dangerZoneScope.add(
    bindElementClick(resetProgressButtonEl, () => {
      resetProgressConfirmInputEl.value = '';
      resetProgressConfirmButtonEl.disabled = true;
      if (supportsProgressModalDialog) {
        resetProgressDialogEl.showModal();
      } else {
        resetProgressDialogEl.setAttribute('open', '');
      }
      resetProgressConfirmInputEl.focus();
    }),
  );
  dangerZoneScope.add(
    bindElementClick(unlockAllMissionsButtonEl, () => {
      unlockAllMissionsConfirmInputEl.value = '';
      unlockAllMissionsConfirmButtonEl.disabled = true;
      if (supportsUnlockAllMissionsModalDialog) {
        unlockAllMissionsDialogEl.showModal();
      } else {
        unlockAllMissionsDialogEl.setAttribute('open', '');
      }
      unlockAllMissionsConfirmInputEl.focus();
    }),
  );
  dangerZoneScope.add(
    bindElementClick(unlockAllMissionsCancelButtonEl, () => {
      closeUnlockAllMissionsDialog();
    }),
  );
  dangerZoneScope.add(
    bindElementClick(unlockAllMissionsConfirmButtonEl, async () => {
      const canUnlock = await isValidUnlockMissionsCode(unlockAllMissionsConfirmInputEl.value);
      if (!canUnlock) {
        unlockAllMissionsConfirmButtonEl.disabled = true;
        return;
      }
      unlockAllMissionsProgress();
      closeUnlockAllMissionsDialog();
    }),
  );
  dangerZoneScope.add(
    bindElementClick(resetProgressCancelButtonEl, () => {
      closeResetProgressDialog();
    }),
  );
  dangerZoneScope.add(
    bindElementClick(resetProgressConfirmButtonEl, () => {
      if (resetProgressConfirmInputEl.value.trim() !== RESET_CONFIRMATION_PHRASE) {
        return;
      }
      resetGameProgressToDefaults();
      closeResetProgressDialog();
      window.location.reload();
    }),
  );
  dangerZoneScope.add(
    bindElementClick(resetCodeButtonEl, () => {
      resetCodeConfirmInputEl.value = '';
      resetCodeConfirmButtonEl.disabled = true;
      if (supportsCodeModalDialog) {
        resetCodeDialogEl.showModal();
      } else {
        resetCodeDialogEl.setAttribute('open', '');
      }
      resetCodeConfirmInputEl.focus();
    }),
  );
  dangerZoneScope.add(
    bindElementClick(resetCodeCancelButtonEl, () => {
      closeResetCodeDialog();
    }),
  );
  dangerZoneScope.add(
    bindElementClick(resetCodeConfirmButtonEl, () => {
      if (resetCodeConfirmInputEl.value.trim() !== RESET_CODE_CONFIRMATION_PHRASE) {
        return;
      }
      resetEditorCodeToDefault();
      closeResetCodeDialog();
    }),
  );

  const onProgressInputChange = (): void => {
    resetProgressConfirmButtonEl.disabled =
      resetProgressConfirmInputEl.value.trim() !== RESET_CONFIRMATION_PHRASE;
  };
  let unlockMissionsValidationId = 0;
  const onUnlockMissionsInputChange = (): void => {
    unlockAllMissionsConfirmButtonEl.disabled = true;
    const input = unlockAllMissionsConfirmInputEl.value;
    const validationId = unlockMissionsValidationId + 1;
    unlockMissionsValidationId = validationId;
    void isValidUnlockMissionsCode(input).then((canUnlock) => {
      if (validationId !== unlockMissionsValidationId) {
        return;
      }
      unlockAllMissionsConfirmButtonEl.disabled = !canUnlock;
    });
  };
  const onUnlockMissionsKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      closeUnlockAllMissionsDialog();
      return;
    }
    if (event.key === 'Enter' && !unlockAllMissionsConfirmButtonEl.disabled) {
      event.preventDefault();
      unlockAllMissionsConfirmButtonEl.click();
    }
  };
  const onProgressKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      closeResetProgressDialog();
      return;
    }
    if (event.key === 'Enter' && !resetProgressConfirmButtonEl.disabled) {
      event.preventDefault();
      resetProgressConfirmButtonEl.click();
    }
  };
  const onCodeInputChange = (): void => {
    resetCodeConfirmButtonEl.disabled =
      resetCodeConfirmInputEl.value.trim() !== RESET_CODE_CONFIRMATION_PHRASE;
  };
  const onCodeKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      closeResetCodeDialog();
      return;
    }
    if (event.key === 'Enter' && !resetCodeConfirmButtonEl.disabled) {
      event.preventDefault();
      resetCodeConfirmButtonEl.click();
    }
  };

  unlockAllMissionsConfirmInputEl.addEventListener('input', onUnlockMissionsInputChange);
  unlockAllMissionsDialogEl.addEventListener('keydown', onUnlockMissionsKeyDown);
  resetProgressConfirmInputEl.addEventListener('input', onProgressInputChange);
  resetProgressDialogEl.addEventListener('keydown', onProgressKeyDown);
  resetCodeConfirmInputEl.addEventListener('input', onCodeInputChange);
  resetCodeDialogEl.addEventListener('keydown', onCodeKeyDown);
  dangerZoneScope.add(() => {
    unlockAllMissionsConfirmInputEl.removeEventListener('input', onUnlockMissionsInputChange);
    unlockAllMissionsDialogEl.removeEventListener('keydown', onUnlockMissionsKeyDown);
    resetProgressConfirmInputEl.removeEventListener('input', onProgressInputChange);
    resetProgressDialogEl.removeEventListener('keydown', onProgressKeyDown);
    resetCodeConfirmInputEl.removeEventListener('input', onCodeInputChange);
    resetCodeDialogEl.removeEventListener('keydown', onCodeKeyDown);
  });
}

function wireWindowLifecycleBindings(): void {
  windowLifecycleScope.disposeAll();
  const onPageHide = (event: PageTransitionEvent): void => {
    if (!event.persisted) {
      teardownGame();
    }
  };
  const onBeforeUnload = (): void => {
    teardownGame();
  };
  windowLifecycleScope.add(bindWindowLifecycle(window, onPageHide, onBeforeUnload));
}

function wireEditorResizeHandle(): void {
  editorResizeScope.disposeAll();
  const abortController = new AbortController();
  const { signal } = abortController;
  let dragging = false;
  let startY = 0;
  let startHeight = 0;

  const clampHeight = (value: number): number => {
    const minHeight = 220;
    return Math.max(minHeight, Math.round(value));
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) {
      return;
    }
    event.preventDefault();
    const nextHeight = clampHeight(startHeight + (event.clientY - startY));
    editorPanelEl.style.height = `${nextHeight}px`;
    window.dispatchEvent(new Event('resize'));
  };

  const onMoveY = (clientY: number): void => {
    const nextHeight = clampHeight(startHeight + (clientY - startY));
    editorPanelEl.style.height = `${nextHeight}px`;
    window.dispatchEvent(new Event('resize'));
  };

  const onPointerUp = (): void => {
    dragging = false;
    document.body.classList.remove('dragging-editor-resize');
  };

  editorResizerEl.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 && event.pointerType !== 'touch') {
        return;
      }
      event.preventDefault();
      dragging = true;
      startY = event.clientY;
      startHeight = editorPanelEl.getBoundingClientRect().height;
      document.body.classList.add('dragging-editor-resize');
      editorResizerEl.setPointerCapture(event.pointerId);
    },
    { signal },
  );
  editorResizerEl.addEventListener(
    'mousedown',
    (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      dragging = true;
      startY = event.clientY;
      startHeight = editorPanelEl.getBoundingClientRect().height;
      document.body.classList.add('dragging-editor-resize');
    },
    { signal },
  );
  editorResizerEl.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      event.preventDefault();
      dragging = true;
      startY = touch.clientY;
      startHeight = editorPanelEl.getBoundingClientRect().height;
      document.body.classList.add('dragging-editor-resize');
    },
    { passive: false, signal },
  );
  window.addEventListener('pointermove', onPointerMove, { passive: false, signal });
  window.addEventListener(
    'mousemove',
    (event) => {
      if (!dragging) {
        return;
      }
      onMoveY(event.clientY);
    },
    { signal },
  );
  window.addEventListener(
    'touchmove',
    (event) => {
      if (!dragging) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      event.preventDefault();
      onMoveY(touch.clientY);
    },
    { passive: false, signal },
  );
  window.addEventListener('pointerup', onPointerUp, { signal });
  window.addEventListener('pointercancel', onPointerUp, { signal });
  window.addEventListener('mouseup', onPointerUp, { signal });
  window.addEventListener('touchend', onPointerUp, { signal });
  window.addEventListener('touchcancel', onPointerUp, { signal });

  editorResizeScope.add(() => {
    abortController.abort();
    document.body.classList.remove('dragging-editor-resize');
  });
}

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
        akiuSpalva: string;
        arklioSpalva: string;
        karciuSpalva: string;
        suKepure: boolean;
        kepuresTipas: string;
        oroEfektas: string;
        mood: HorseMood;
      };
      readHorseRuntime(): { noteParticles: number };
      readTechnicalNoticeIcons(): {
        horse: { x: number; y: number; r: number } | null;
        weather: { x: number; y: number; r: number } | null;
      };
      isTechnicalNoticeExpanded(): boolean;
      isCompileValid(): boolean;
      getRules(): DanceRules;
      readEditorSource(): string;
      readAudioState(): {
        guideNotesRequested: number;
        guideNotesPlayed: number;
        backingNotesRequested: number;
        backingNotesPlayed: number;
      };
      readAudioRuntime(): {
        userMuted: boolean;
        outputMuted: boolean;
      };
      readAudioVisualizer(): { level: number; peak: number; bars: number[] };
      readPerformance(): {
        fps: number;
        frameMs: number;
        visualCapFps: number;
        mobileMode: boolean;
      };
      readPlaybackTracking(): {
        autoPlayedBeatIds: number;
        songPlayedBeatIds: number;
      };
    };
  }
}

window.__rhythmTest = {
  setAutoplay(enabled: boolean): void {
    autoplayEnabled = enabled;
    renderAutoplayUiState();
  },
  resetScore(): void {
    state.resetRun();
    autoPlayedBeatIds.clear();
    songPlayedBeatIds.clear();
    pendingSongBeats.clear();
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
    const note = engine.getBeatsInRange(now, now + 3).find((candidate) => candidate.lane === lane);
    if (!note) {
      return false;
    }

    startLanePress(note.timeSec + offsetSec, lane);
    return true;
  },
  playNearestAny(offsetSec: number): boolean {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, now + 3)[0];
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
      .getBeatsInRange(now, now + 8)
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
      .getBeatsInRange(now + Math.max(0, minAheadSec), now + 6)
      .find((candidate) => candidate.holdDurationSec === 0);
    return note ? { id: note.id, timeSec: note.timeSec, lane: note.lane } : null;
  },
  wasSongBeatPlayed(beatId: number): boolean {
    return songPlayedBeatIds.has(beatId);
  },
  peekNearestLane(lane: number): { id: number; timeSec: number; lane: number } | null {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, now + 3).find((candidate) => candidate.lane === lane);
    return note ?? null;
  },
  peekNearestAny(): { id: number; timeSec: number; lane: number } | null {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine.getBeatsInRange(now, now + 3)[0];
    return note ? { id: note.id, timeSec: note.timeSec, lane: note.lane } : null;
  },
  peekNearestHold(
    lane: number,
  ): { id: number; timeSec: number; lane: number; holdDurationSec: number } | null {
    const now = performance.now() / 1000;
    engine.update(now);
    const note = engine
      .getBeatsInRange(now, now + 4)
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
    const note = engine
      .getBeatsInRange(now, now + 4)
      .find((candidate) => candidate.holdDurationSec > 0);
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
    akiuSpalva: string;
    arklioSpalva: string;
    karciuSpalva: string;
    suKepure: boolean;
    kepuresTipas: string;
    oroEfektas: string;
    mood: HorseMood;
  } {
    return horseAnimator.getVisualState();
  },
  readHorseRuntime(): { noteParticles: number } {
    return horseAnimator.getRuntimeStats();
  },
  readTechnicalNoticeIcons(): {
    horse: { x: number; y: number; r: number } | null;
    weather: { x: number; y: number; r: number } | null;
  } {
    const horse = horseAnimator.getTechnicalNoticeIconHit();
    const weather = weatherTechnicalNoticeIconHit;
    return {
      horse: horse ? { x: horse.x, y: horse.y, r: horse.r } : null,
      weather: weather ? { x: weather.x, y: weather.y, r: weather.r } : null,
    };
  },
  isTechnicalNoticeExpanded(): boolean {
    return technicalNoticeExpanded;
  },
  isCompileValid(): boolean {
    return compileIsValid;
  },
  getRules(): DanceRules {
    return rules;
  },
  readEditorSource(): string {
    return readEditorSource();
  },
  readAudioState(): {
    guideNotesRequested: number;
    guideNotesPlayed: number;
    backingNotesRequested: number;
    backingNotesPlayed: number;
  } {
    return audio.readDebugState();
  },
  readAudioRuntime(): {
    userMuted: boolean;
    outputMuted: boolean;
  } {
    const runtime = audio.readRuntimeStats();
    return {
      userMuted: runtime.userMuted,
      outputMuted: runtime.outputMuted,
    };
  },
  readAudioVisualizer(): { level: number; peak: number; bars: number[] } {
    return audio.sampleVisualizer(24);
  },
  readPerformance(): { fps: number; frameMs: number; visualCapFps: number; mobileMode: boolean } {
    const mobileMode = isMobilePerformanceMode();
    return {
      fps: latestMeasuredFps,
      frameMs: latestMeasuredFrameMs,
      visualCapFps: mobileMode ? (autoplayEnabled ? 36 : 45) : 60,
      mobileMode,
    };
  },
  readPlaybackTracking(): { autoPlayedBeatIds: number; songPlayedBeatIds: number } {
    return {
      autoPlayedBeatIds: autoPlayedBeatIds.size,
      songPlayedBeatIds: songPlayedBeatIds.size,
    };
  },
};

async function bootstrapGame(): Promise<void> {
  await compiler.init();
  persistedSolvedPuzzleCount = readSolvedPuzzleCount();
  soundMuted = readSoundMuted();
  audio.setMuted(soundMuted);
  persistEditorSource(INITIAL_EDITOR_SOURCE);
  await initEditor();
  wireTemplateButtons();
  wireAudioBootstrap();
  wireCanvasResize();
  wireInputs();
  wireHudToggles();
  wireEditorResizeHandle();
  wireDangerZone();
  wireWindowLifecycleBindings();
  renderAutoplayUiState();
  renderSoundUiState();
  applyGlobalWeatherTheme(rules.oroEfektas);
  renderPuzzleProgress();
  renderCompileNoticeRail();
  renderHorseCompileNotice();
  fitHudValuesToBox();
  requestAnimationFrame(resizeCanvas);
  state.goTo('play');
  state.resetRun();
  startLoop();
}

void bootstrapGame();
