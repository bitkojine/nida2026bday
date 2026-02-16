import type { HorseMood } from '../core/types';
import type { DanceRules } from '../core/types';

export type WeatherSceneRenderMode = 'normal' | 'technical-test';
export interface TechnicalNoticeIconHit {
  x: number;
  y: number;
  r: number;
}

const HORSE_COLOR_PALETTE: Record<DanceRules['arklioSpalva'], string> = {
  SMELIO: '#d6b48a',
  TAMSIAI_RUDA: '#7d4f2d',
  RUDA: '#9b6a43',
  JUODA: '#2b1f12',
  BALTA: '#f2f2ee',
  AUKSINE: '#d9b251',
  ROZINE: '#ff93d1',
  MELYNA: '#5a8fe8',
  ZALIA: '#4f9e6b',
  VIOLETINE: '#7f63d6',
  ORANZINE: '#ff9f66',
};

function resolveHorseColor(color: DanceRules['arklioSpalva']): string {
  return HORSE_COLOR_PALETTE[color] ?? HORSE_COLOR_PALETTE.SMELIO;
}

function pseudoRandom01(seed: number): number {
  const raw = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return raw - Math.floor(raw);
}

function getLogicalCanvasSize(
  canvas: HTMLCanvasElement,
  dprScale: number,
): { width: number; height: number } {
  const safeScale = Math.max(1, dprScale);
  const width = Math.max(1, Math.round(canvas.width / safeScale));
  const height = Math.max(1, Math.round(canvas.height / safeScale));
  return { width, height };
}

function wrapLineToWidth(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string[] {
  const words = line
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (words.length === 0) {
    return [''];
  }

  const wrapped: string[] = [];
  const normalizeWordParts = (word: string): string[] => {
    if (ctx.measureText(word).width <= maxWidth) {
      return [word];
    }
    const parts: string[] = [];
    let part = '';
    for (const ch of word) {
      const candidate = `${part}${ch}`;
      if (part.length > 0 && ctx.measureText(candidate).width > maxWidth) {
        parts.push(part);
        part = ch;
      } else {
        part = candidate;
      }
    }
    if (part.length > 0) {
      parts.push(part);
    }
    return parts.length > 0 ? parts : [word];
  };
  const expandedWords = words.flatMap((word) => normalizeWordParts(word));
  let current = expandedWords[0];
  for (let index = 1; index < expandedWords.length; index += 1) {
    const candidate = `${current} ${expandedWords[index]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    wrapped.push(current);
    current = expandedWords[index];
  }
  wrapped.push(current);
  return wrapped;
}

export function renderWeatherScene(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number,
  rules: DanceRules,
  mode: WeatherSceneRenderMode = 'normal',
  technicalWaveformBars?: readonly number[],
  technicalNoticeLines?: readonly string[],
  technicalNoticeExpanded = false,
  technicalNoticeIconHit?: TechnicalNoticeIconHit | null,
): void {
  if (mode === 'technical-test') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0f1827');
    sky.addColorStop(1, '#16243a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const gridSize = Math.max(16, Math.round(Math.min(w, h) / 14));
    ctx.strokeStyle = 'rgba(116, 172, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const bars = ['#f7f7f7', '#ffe04a', '#3cd95f', '#2b99ff', '#ff2fa3', '#0e0e12'];
    const barHeight = Math.max(14, Math.round(h * 0.12));
    const barWidth = w / bars.length;
    for (let i = 0; i < bars.length; i += 1) {
      ctx.fillStyle = bars[i];
      ctx.fillRect(i * barWidth, 0, barWidth + 1, barHeight);
    }

    const waveformBars =
      technicalWaveformBars && technicalWaveformBars.length >= 8 ? technicalWaveformBars : null;
    ctx.strokeStyle = 'rgba(138, 245, 255, 0.72)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    const midY = h * 0.62;
    const amp = h * 0.11;
    if (waveformBars) {
      const smoothed: number[] = [];
      for (let i = 0; i < waveformBars.length; i += 1) {
        const prev = Math.max(0, Math.min(1, waveformBars[i - 1] ?? waveformBars[i] ?? 0));
        const curr = Math.max(0, Math.min(1, waveformBars[i] ?? 0));
        const next = Math.max(0, Math.min(1, waveformBars[i + 1] ?? waveformBars[i] ?? 0));
        smoothed.push(prev * 0.2 + curr * 0.6 + next * 0.2);
      }
      const mean = smoothed.reduce((sum, value) => sum + value, 0) / Math.max(1, smoothed.length);
      const centered = smoothed.map((value) => value - mean);
      const peak = Math.max(0.02, ...centered.map((value) => Math.abs(value)));
      const points = centered.map((value, index) => {
        const x = (index / Math.max(1, centered.length - 1)) * w;
        const y = midY - (value / peak) * amp;
        return { x, y };
      });
      if (points.length > 0) {
        ctx.moveTo(points[0].x, points[0].y);
      }
      if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
      } else if (points.length > 2) {
        for (let i = 1; i < points.length - 1; i += 1) {
          const midX = (points[i].x + points[i + 1].x) / 2;
          const midYPoint = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midYPoint);
        }
        const last = points.length - 1;
        ctx.quadraticCurveTo(
          points[last - 1].x,
          points[last - 1].y,
          points[last].x,
          points[last].y,
        );
      }
    } else {
      for (let x = 0; x <= w; x += 6) {
        const y = midY + Math.sin(x * 0.04 + t * 4.2) * (h * 0.07);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    const largeScene = w >= 900 && h >= 420;
    const outerMarginX = largeScene
      ? Math.max(14, Math.round(w * 0.02))
      : Math.max(4, Math.round(w * 0.02));
    const outerMarginY = largeScene ? Math.max(14, Math.round(h * 0.06)) : 2;
    const panelPadding = largeScene
      ? Math.max(10, Math.round(w * 0.01))
      : Math.max(8, Math.round(w * 0.02));
    const panelX = outerMarginX;
    const panelY = outerMarginY;
    const panelAvailableWidth = Math.max(120, w - outerMarginX * 2);
    const panelMaxWidth = largeScene
      ? Math.min(panelAvailableWidth, Math.round(w * 0.46))
      : Math.min(panelAvailableWidth, Math.round(w * 0.9));
    const panelMaxHeight = largeScene ? Math.round(h * 0.62) : Math.max(80, h - outerMarginY * 2);
    const panelMinWidth = largeScene ? 210 : 132;
    const defaultNoticeLines = [
      'KODAS NESIKOMPILIUOJA',
      '1) Tikrinimas: Tree-sitter C# (WASM).',
      '2) Patikra: DanceRules, enum laukai, AkiuSpalva().',
      '3) Taisykle: gerasLangas turi buti >= tobulasLangas.',
      '4) Rezultatas: reikia pataisyti klaidas.',
    ];
    const fullNoticeLines =
      technicalNoticeLines && technicalNoticeLines.length > 0
        ? technicalNoticeLines
        : defaultNoticeLines;
    const compactNoticeLines = [
      fullNoticeLines[0] ?? 'KODAS NESIKOMPILIUOJA',
      'DAR REIKIA PADIRBETI',
    ];
    const noticeSourceLines = technicalNoticeExpanded ? fullNoticeLines : compactNoticeLines;
    const preferredTextSize = largeScene
      ? Math.max(20, Math.round(h * 0.05))
      : Math.max(14, Math.round(h * 0.11));
    const minTextSize = largeScene ? 12 : 10;

    let primaryTextSize = preferredTextSize;
    let lineGap = Math.max(2, Math.round(primaryTextSize * 0.2));
    let wrappedLines: string[] = [];
    let panelWidth = Math.max(panelMinWidth, panelMaxWidth);
    let panelHeight = 0;
    let iconRadius = 0;
    let iconSlotWidth = 0;

    const recalcPanelGeometry = (): void => {
      ctx.font = `800 ${primaryTextSize}px "Space Grotesk", sans-serif`;
      iconRadius = Math.max(10, Math.round(primaryTextSize * 0.55));
      iconSlotWidth = iconRadius * 2 + Math.max(8, Math.round(panelPadding * 0.75));
      const maxTextWidth = Math.max(72, panelWidth - panelPadding * 2 - iconSlotWidth);
      wrappedLines = [];
      for (const sourceLine of noticeSourceLines) {
        const lines = wrapLineToWidth(ctx, sourceLine, maxTextWidth);
        wrappedLines.push(...lines);
      }
      const contentWidth = wrappedLines.reduce((maxWidth, line) => {
        const width = ctx.measureText(line).width;
        return Math.max(maxWidth, width);
      }, 0);
      panelWidth = Math.min(
        panelMaxWidth,
        Math.max(panelMinWidth, Math.ceil(contentWidth + panelPadding * 2 + iconSlotWidth)),
      );
      const contentHeight = Math.ceil(
        panelPadding * 2 +
          wrappedLines.length * primaryTextSize +
          (wrappedLines.length - 1) * lineGap,
      );
      panelHeight = largeScene ? contentHeight : Math.max(contentHeight, panelMaxHeight);
    };

    recalcPanelGeometry();
    while (panelHeight > panelMaxHeight && primaryTextSize > minTextSize) {
      primaryTextSize -= 1;
      lineGap = Math.max(2, Math.round(primaryTextSize * 0.2));
      recalcPanelGeometry();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = 'rgba(14, 29, 49, 0.88)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = 'rgba(147, 208, 255, 0.64)';
    ctx.lineWidth = largeScene ? 2 : 1.5;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    const iconCx = panelX + panelWidth - panelPadding - iconRadius;
    const iconCy = panelY + panelPadding + iconRadius;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, iconRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 54, 82, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(177, 220, 255, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#d9efff';
    ctx.font = `800 ${Math.max(12, Math.round(iconRadius * 1.1))}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', iconCx, iconCy + 0.5);
    if (technicalNoticeIconHit) {
      technicalNoticeIconHit.x = iconCx;
      technicalNoticeIconHit.y = iconCy;
      technicalNoticeIconHit.r = iconRadius;
    }

    const textX = panelX + panelPadding;
    const textY = panelY + panelPadding;
    ctx.fillStyle = '#d8eeff';
    ctx.font = `800 ${primaryTextSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(4, 9, 18, 0.7)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    for (let index = 0; index < wrappedLines.length; index += 1) {
      const lineY = textY + index * (primaryTextSize + lineGap);
      const color = index === 0 ? '#d8eeff' : '#b9d9ff';
      ctx.fillStyle = color;
      ctx.fillText(wrappedLines[index], textX, lineY);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }

  const sceneScale = Math.max(1, Math.min(2.2, Math.min(w, h) / 320));
  const sunRadius = 14 * sceneScale;
  const sunInsetX = 18 * sceneScale;
  const sunInsetY = 14 * sceneScale;
  const sunX = Math.max(sunRadius + 2, w - sunRadius - sunInsetX);
  const sunY = Math.max(sunRadius + 2, sunRadius + sunInsetY);
  const cloudBaseRadius = 12 * sceneScale;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  const rainy = rules.oroEfektas === 'LIETINGA';
  const snowy = rules.oroEfektas === 'SNIEGAS';
  const thunder = rules.oroEfektas === 'ZAIBAS';
  if (rainy) {
    sky.addColorStop(0, '#4f6478');
    sky.addColorStop(0.55, '#6f8598');
    sky.addColorStop(1, '#8ea0af');
  } else if (thunder) {
    sky.addColorStop(0, '#38485c');
    sky.addColorStop(0.55, '#4f6176');
    sky.addColorStop(1, '#697b8f');
  } else if (snowy) {
    sky.addColorStop(0, '#6a7f92');
    sky.addColorStop(0.55, '#8fa2b1');
    sky.addColorStop(1, '#b2c0cb');
  } else {
    sky.addColorStop(0, '#87c8ff');
    sky.addColorStop(0.55, '#bfe6ff');
    sky.addColorStop(1, '#e7f6ff');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const hill = ctx.createLinearGradient(0, h * 0.58, 0, h);
  if (rainy) {
    hill.addColorStop(0, '#5f7a63');
    hill.addColorStop(1, '#3f5e49');
  } else if (thunder) {
    hill.addColorStop(0, '#4f6656');
    hill.addColorStop(1, '#314638');
  } else if (snowy) {
    hill.addColorStop(0, '#d9e0e5');
    hill.addColorStop(1, '#b2bcc7');
  } else {
    hill.addColorStop(0, '#8fd380');
    hill.addColorStop(1, '#5ea95c');
  }
  ctx.fillStyle = hill;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.66);
  ctx.quadraticCurveTo(w * 0.28, h * 0.57, w * 0.5, h * 0.66);
  ctx.quadraticCurveTo(w * 0.74, h * 0.74, w, h * 0.66);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rainy || thunder ? 'rgba(223, 236, 244, 0.32)' : 'rgba(255, 255, 255, 0.52)';
  const cloudCount = Math.max(3, Math.round(3 + sceneScale));
  for (let i = 0; i < cloudCount; i += 1) {
    const seedBase = i * 19.73 + sceneScale * 3.1;
    const cloudWidth = (102 + cloudBaseRadius * 2.5) * (0.86 + pseudoRandom01(seedBase + 1) * 0.46);
    const cloudTravelSpan = w + cloudWidth * 2.3;
    const cloudSpeed = 3.8 + pseudoRandom01(seedBase + 2) * 4.4;
    const cloudPhase = pseudoRandom01(seedBase + 3) * cloudTravelSpan;
    const cloudX = ((cloudPhase + t * cloudSpeed) % cloudTravelSpan) - cloudWidth * 1.15;
    const cloudY = 12 + pseudoRandom01(seedBase + 4) * Math.min(86 * sceneScale, h * 0.24);
    const topRadius = cloudBaseRadius * (0.72 + pseudoRandom01(seedBase + 5) * 0.4);
    const rightRadius = cloudBaseRadius * (0.78 + pseudoRandom01(seedBase + 6) * 0.34);
    const midOffsetX = cloudBaseRadius * (1.02 + pseudoRandom01(seedBase + 7) * 0.45);
    const rightOffsetX = cloudBaseRadius * (1.88 + pseudoRandom01(seedBase + 8) * 0.5);
    const midOffsetY = cloudBaseRadius * (0.15 + pseudoRandom01(seedBase + 9) * 0.24);
    ctx.beginPath();
    ctx.arc(cloudX, cloudY, cloudBaseRadius, 0, Math.PI * 2);
    ctx.arc(cloudX + midOffsetX, cloudY - midOffsetY, topRadius, 0, Math.PI * 2);
    ctx.arc(cloudX + rightOffsetX, cloudY, rightRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = rainy
    ? 'rgba(42, 83, 54, 0.56)'
    : thunder
      ? 'rgba(36, 63, 43, 0.62)'
      : snowy
        ? 'rgba(178, 191, 204, 0.52)'
        : 'rgba(56, 116, 56, 0.42)';
  ctx.fillRect(0, h * 0.76, w, h * 0.24);

  if (thunder) {
    const flash = Math.max(0, Math.sin(t * 7.5)) * Math.max(0, Math.sin(t * 19.2));
    if (flash > 0.55) {
      ctx.fillStyle = `rgba(220, 236, 255, ${(flash - 0.55) * 0.52})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  if (rules.oroEfektas === 'SAULETA') {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 216, 109, 0.95)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 216, 109, 0.7)';
    ctx.lineWidth = 2 * sceneScale;
    for (let i = 0; i < 8; i += 1) {
      const rayAngle = (i / 8) * Math.PI * 2 + Math.sin(t * 2) * 0.08;
      const x1 = sunX + Math.cos(rayAngle) * (sunRadius + 6 * sceneScale);
      const y1 = sunY + Math.sin(rayAngle) * (sunRadius + 6 * sceneScale);
      const x2 = sunX + Math.cos(rayAngle) * (sunRadius + 14 * sceneScale);
      const y2 = sunY + Math.sin(rayAngle) * (sunRadius + 14 * sceneScale);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (rules.oroEfektas === 'LIETINGA') {
    ctx.save();
    ctx.lineCap = 'round';

    const frontCount = Math.max(26, Math.round((w / 34) * sceneScale));
    ctx.strokeStyle = 'rgba(168, 214, 255, 0.54)';
    ctx.lineWidth = Math.max(1.6, 1.2 * sceneScale);
    for (let i = 0; i < frontCount; i += 1) {
      const seedBase = i * 27.11 + sceneScale * 17.9;
      const spanX = w + 120;
      const spanY = h + 140;
      const windSpeed = 34 + pseudoRandom01(seedBase + 1) * 36;
      const fallSpeed = 300 + pseudoRandom01(seedBase + 2) * 190;
      const x = ((pseudoRandom01(seedBase + 3) * spanX + t * windSpeed) % spanX) - 60;
      const y = ((pseudoRandom01(seedBase + 4) * spanY + t * fallSpeed) % spanY) - 70;
      const len = (15 + pseudoRandom01(seedBase + 5) * 16) * sceneScale;
      const slant = (5.8 + pseudoRandom01(seedBase + 6) * 4.2) * sceneScale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant, y + len);
      ctx.stroke();
    }

    const backCount = Math.max(18, Math.round((w / 48) * sceneScale));
    ctx.strokeStyle = 'rgba(138, 190, 238, 0.34)';
    ctx.lineWidth = Math.max(1, 0.95 * sceneScale);
    for (let i = 0; i < backCount; i += 1) {
      const seedBase = i * 35.03 + sceneScale * 29.7;
      const spanX = w + 100;
      const spanY = h + 120;
      const windSpeed = 22 + pseudoRandom01(seedBase + 1) * 24;
      const fallSpeed = 200 + pseudoRandom01(seedBase + 2) * 130;
      const x = ((pseudoRandom01(seedBase + 3) * spanX + t * windSpeed) % spanX) - 50;
      const y = ((pseudoRandom01(seedBase + 4) * spanY + t * fallSpeed) % spanY) - 60;
      const len = (10 + pseudoRandom01(seedBase + 5) * 11) * sceneScale;
      const slant = (3.5 + pseudoRandom01(seedBase + 6) * 2.7) * sceneScale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant, y + len);
      ctx.stroke();
    }

    const mist = ctx.createLinearGradient(0, h * 0.54, 0, h);
    mist.addColorStop(0, 'rgba(120, 165, 196, 0)');
    mist.addColorStop(0.72, 'rgba(92, 137, 171, 0.2)');
    mist.addColorStop(1, 'rgba(72, 112, 145, 0.28)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * 0.54, w, h * 0.46);
    ctx.restore();
    return;
  }

  if (rules.oroEfektas === 'ZAIBAS') {
    ctx.save();
    ctx.strokeStyle = 'rgba(153, 206, 255, 0.58)';
    ctx.lineWidth = Math.max(2.3, 2 * sceneScale);
    const dropCount = Math.max(12, Math.round((w / 88) * sceneScale));
    for (let i = 0; i < dropCount; i += 1) {
      const seedBase = i * 41.47 + sceneScale * 11.2;
      const spanX = w + 80;
      const spanY = h + 74;
      const windSpeed = 26 + pseudoRandom01(seedBase + 1) * 20;
      const fallSpeed = 170 + pseudoRandom01(seedBase + 2) * 120;
      const x = ((pseudoRandom01(seedBase + 3) * spanX + t * windSpeed) % spanX) - 40;
      const y = ((pseudoRandom01(seedBase + 4) * spanY + t * fallSpeed) % spanY) - 32;
      const slant = (4.2 + pseudoRandom01(seedBase + 5) * 2.8) * sceneScale;
      const len = (10.5 + pseudoRandom01(seedBase + 6) * 4.6) * sceneScale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant, y + len);
      ctx.stroke();
    }

    const strikePulse = Math.max(0, Math.sin(t * 6.6)) * Math.max(0, Math.sin(t * 13.8));
    if (strikePulse > 0.62) {
      ctx.strokeStyle = `rgba(255, 249, 194, ${0.35 + (strikePulse - 0.62) * 1.1})`;
      ctx.lineWidth = Math.max(3.2, 2.6 * sceneScale);
      const baseX = w * (0.24 + (Math.sin(t * 1.7) + 1) * 0.5 * 0.52);
      ctx.beginPath();
      ctx.moveTo(baseX, 14);
      ctx.lineTo(baseX - 14 * sceneScale, 48 * sceneScale);
      ctx.lineTo(baseX + 6 * sceneScale, 48 * sceneScale);
      ctx.lineTo(baseX - 16 * sceneScale, 92 * sceneScale);
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(239, 248, 255, 0.9)';
  const flakeCount = Math.max(16, Math.round((w / 64) * sceneScale));
  for (let i = 0; i < flakeCount; i += 1) {
    const seedBase = i * 23.81 + sceneScale * 5.7;
    const spanX = w + 40;
    const spanY = h + 30;
    const fallSpeed = 30 + pseudoRandom01(seedBase + 1) * 42;
    const driftSpeed = 4 + pseudoRandom01(seedBase + 2) * 10;
    const baseX = ((pseudoRandom01(seedBase + 3) * spanX + t * driftSpeed) % spanX) - 20;
    const sway =
      Math.sin(t * (0.7 + pseudoRandom01(seedBase + 4) * 1.3) + seedBase) *
      (3 + 5 * pseudoRandom01(seedBase + 5));
    const x = baseX + sway * sceneScale;
    const y = ((pseudoRandom01(seedBase + 6) * spanY + t * fallSpeed) % spanY) - 15;
    const radius = (1.4 + pseudoRandom01(seedBase + 7) * 1.4) * sceneScale;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export class HorseAnimator {
  private noteParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    lifeSec: number;
    maxLifeSec: number;
    glyph: '♪' | '♫';
    spin: number;
    lane: number | null;
  }> = [];

  private lastFrameSec: number | null = null;

  private lastPerfectEmitSec = -10;

  private lastVisualState: {
    akiuSpalva: string;
    arklioSpalva: string;
    karciuSpalva: string;
    suKepure: boolean;
    kepuresTipas: string;
    oroEfektas: string;
    mood: HorseMood;
  } = {
    akiuSpalva: '#2b1f12',
    arklioSpalva: '#d6b48a',
    karciuSpalva: '#7d4f2d',
    suKepure: false,
    kepuresTipas: 'KLASIKINE',
    oroEfektas: 'SAULETA',
    mood: 'GERAI',
  };

  private lastTechnicalNoticeIconHit: TechnicalNoticeIconHit | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private getLaneGlowPalette(lane: number | null): {
    shadow: string;
    auraStroke: string;
    auraInner: string;
    stream: string;
  } {
    switch (lane) {
      case 0:
        return {
          shadow: '#ff8f82',
          auraStroke: 'rgba(255, 136, 122, 0.98)',
          auraInner: 'rgba(255, 172, 158, 0.94)',
          stream: 'rgba(255, 207, 200, 0.98)',
        };
      case 1:
        return {
          shadow: '#ffd564',
          auraStroke: 'rgba(255, 213, 100, 0.98)',
          auraInner: 'rgba(255, 229, 151, 0.95)',
          stream: 'rgba(255, 241, 197, 0.98)',
        };
      case 2:
        return {
          shadow: '#63a6ff',
          auraStroke: 'rgba(99, 166, 255, 0.98)',
          auraInner: 'rgba(162, 205, 255, 0.95)',
          stream: 'rgba(214, 232, 255, 0.98)',
        };
      case 3:
        return {
          shadow: '#76d97e',
          auraStroke: 'rgba(118, 217, 126, 0.98)',
          auraInner: 'rgba(179, 236, 185, 0.95)',
          stream: 'rgba(224, 248, 226, 0.98)',
        };
      default:
        return {
          shadow: '#7fe4ff',
          auraStroke: 'rgba(152, 228, 255, 0.98)',
          auraInner: 'rgba(151, 229, 255, 0.95)',
          stream: 'rgba(208, 244, 255, 0.98)',
        };
    }
  }

  getVisualState(): {
    akiuSpalva: string;
    arklioSpalva: string;
    karciuSpalva: string;
    suKepure: boolean;
    kepuresTipas: string;
    oroEfektas: string;
    mood: HorseMood;
  } {
    return { ...this.lastVisualState };
  }

  getRuntimeStats(): { noteParticles: number } {
    return { noteParticles: this.noteParticles.length };
  }

  getTechnicalNoticeIconHit(): TechnicalNoticeIconHit | null {
    return this.lastTechnicalNoticeIconHit;
  }

  clearNoteParticles(): void {
    this.noteParticles = [];
  }

  emitPerfectNotes(lane: number | null): void {
    const nowSec = this.lastFrameSec ?? performance.now() / 1000;
    const sinceLast = nowSec - this.lastPerfectEmitSec;
    const burstCount = sinceLast < 0.22 ? 2 : 4;
    this.lastPerfectEmitSec = nowSec;

    for (let i = 0; i < burstCount; i += 1) {
      const speed = 38 + Math.random() * 34;
      const angle = -0.52 + Math.random() * 0.5;
      this.noteParticles.push({
        x: 104 + Math.random() * 6,
        y: -28 + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed + 20,
        vy: Math.sin(angle) * speed - 12,
        lifeSec: 1.15 + Math.random() * 0.45,
        maxLifeSec: 1.15 + Math.random() * 0.45,
        glyph: Math.random() > 0.55 ? '♫' : '♪',
        spin: (Math.random() - 0.5) * 1.8,
        lane,
      });
    }

    if (this.noteParticles.length > 42) {
      this.noteParticles.splice(0, this.noteParticles.length - 42);
    }
  }

  private drawNoteParticles(
    dtSec: number,
    mood: HorseMood,
    isHolding: boolean,
    holdingLane: number | null,
  ): void {
    const holdPalette = this.getLaneGlowPalette(holdingLane);
    if (isHolding && Math.random() < 0.08) {
      this.noteParticles.push({
        x: 106 + Math.random() * 3,
        y: -27 + (Math.random() - 0.5) * 4,
        vx: 42 + Math.random() * 16,
        vy: -10 - Math.random() * 9,
        lifeSec: 0.55 + Math.random() * 0.25,
        maxLifeSec: 0.55 + Math.random() * 0.25,
        glyph: Math.random() > 0.6 ? '♫' : '♪',
        spin: (Math.random() - 0.5) * 1.2,
        lane: holdingLane,
      });
    }

    if (this.noteParticles.length === 0) {
      return;
    }

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '700 16px "Space Grotesk", sans-serif';

    const survivors: typeof this.noteParticles = [];
    for (const particle of this.noteParticles) {
      const lifeLeft = particle.lifeSec - dtSec;
      if (lifeLeft <= 0) {
        continue;
      }

      const fade = Math.max(0, Math.min(1, lifeLeft / particle.maxLifeSec));
      particle.lifeSec = lifeLeft;
      particle.x += particle.vx * dtSec;
      particle.y += particle.vy * dtSec;
      particle.vx *= 0.995;
      particle.vy -= 12 * dtSec;
      particle.vy *= 0.985;

      const particlePalette = this.getLaneGlowPalette(particle.lane);
      const accent =
        particle.lane !== null
          ? particlePalette.auraInner
          : isHolding
            ? holdPalette.auraInner
            : mood === 'UZSIVEDIMAS'
              ? '#ffe08a'
              : '#fff6d7';
      const outline =
        particle.lane !== null
          ? 'rgba(37, 29, 20, 0.72)'
          : isHolding
            ? 'rgba(44, 32, 20, 0.72)'
            : mood === 'UZSIVEDIMAS'
              ? '#8d4b00'
              : '#72522c';

      this.ctx.save();
      this.ctx.globalAlpha = fade;
      this.ctx.translate(particle.x, particle.y);
      this.ctx.rotate((1 - fade) * particle.spin);
      this.ctx.strokeStyle = outline;
      this.ctx.lineWidth = 2.1;
      this.ctx.strokeText(particle.glyph, 0, 0);
      this.ctx.fillStyle = accent;
      this.ctx.fillText(particle.glyph, 0, 0);
      this.ctx.restore();

      survivors.push(particle);
    }

    this.noteParticles = survivors;
    this.ctx.restore();
  }

  render(
    timeMs: number,
    mood: HorseMood,
    rules: DanceRules,
    isHolding = false,
    holdingLane: number | null = null,
    sceneMode: WeatherSceneRenderMode = 'normal',
    technicalWaveformBars?: readonly number[],
    technicalNoticeLines?: readonly string[],
    technicalNoticeExpanded = false,
  ): void {
    const { canvas } = this.ctx;
    const scaleX = Math.max(1, this.ctx.getTransform().a || 1);
    const logical = getLogicalCanvasSize(canvas, scaleX);
    const w = logical.width;
    const h = logical.height;
    const t = timeMs / 1000;
    const dtSec =
      this.lastFrameSec === null
        ? 1 / 60
        : Math.max(1 / 240, Math.min(1 / 30, t - this.lastFrameSec));
    this.lastFrameSec = t;
    this.lastVisualState = {
      akiuSpalva: rules.akiuSpalva,
      arklioSpalva: rules.arklioSpalva,
      karciuSpalva: rules.karciuSpalva,
      suKepure: rules.suKepure,
      kepuresTipas: rules.kepuresTipas,
      oroEfektas: rules.oroEfektas,
      mood,
    };

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, w, h);
    this.ctx.clip();
    this.ctx.clearRect(0, 0, w, h);
    const technicalNoticeIconHit: TechnicalNoticeIconHit | null =
      sceneMode === 'technical-test' ? { x: 0, y: 0, r: 0 } : null;
    renderWeatherScene(
      this.ctx,
      t,
      w,
      h,
      rules,
      sceneMode,
      technicalWaveformBars,
      technicalNoticeLines,
      technicalNoticeExpanded,
      technicalNoticeIconHit,
    );
    this.lastTechnicalNoticeIconHit = technicalNoticeIconHit;

    const fitScale = Math.min(w / 260, h / 210, 0.82);
    const amp = fitScale;
    const centerX = w * 0.5;
    const centerY = h * 0.46;
    const holdPulse = Math.sin(t * 13) * 2.2 * amp;
    const sleeping = mood === 'MIEGA';
    const dance = sleeping
      ? Math.sin(t * 1.1) * 1.2 * amp
      : isHolding
        ? holdPulse
        : Math.sin(t * 8) * 8 * amp;
    const stumble = mood === 'PRALEISTA' ? Math.sin(t * 18) * 14 * amp : 0;
    const boost = mood === 'UZSIVEDIMAS' ? 1.16 : 1;
    const holdPalette = this.getLaneGlowPalette(holdingLane);

    if (mood === 'UZSIVEDIMAS' || mood === 'TOBULA' || isHolding) {
      if (mood === 'UZSIVEDIMAS') {
        this.ctx.shadowBlur = 30;
        this.ctx.shadowColor = '#ffd166';
      } else if (isHolding) {
        this.ctx.shadowBlur = 34;
        this.ctx.shadowColor = holdPalette.shadow;
      } else {
        this.ctx.shadowBlur = 16;
        this.ctx.shadowColor = '#ffd166';
      }
    } else {
      this.ctx.shadowBlur = 0;
    }

    this.ctx.save();
    this.ctx.translate(centerX + stumble, centerY + dance);
    this.ctx.scale(boost * fitScale, boost * fitScale);

    if (isHolding) {
      const pulse = (Math.sin(t * 11) + 1) * 0.5;
      const pulse2 = (Math.sin(t * 9 + 0.9) + 1) * 0.5;

      this.ctx.save();
      this.ctx.globalAlpha = 0.32 + pulse * 0.26;
      this.ctx.strokeStyle = holdPalette.auraStroke;
      this.ctx.lineWidth = 3.8;
      this.ctx.beginPath();
      this.ctx.ellipse(2, -2, 95 + pulse * 12, 43 + pulse * 8, 0, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.globalAlpha = 0.2 + pulse2 * 0.22;
      this.ctx.strokeStyle = holdPalette.stream;
      this.ctx.lineWidth = 2.8;
      this.ctx.beginPath();
      this.ctx.ellipse(6, -3, 106 + pulse2 * 14, 51 + pulse2 * 8, 0, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.globalAlpha = 0.16 + pulse * 0.18;
      this.ctx.fillStyle = holdPalette.auraInner;
      this.ctx.beginPath();
      this.ctx.ellipse(2, -4, 84 + pulse * 8, 31 + pulse * 5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.globalAlpha = 0.56 + pulse * 0.28;
      this.ctx.strokeStyle = holdPalette.stream;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(108, -27);
      this.ctx.quadraticCurveTo(
        127 + pulse * 8,
        -38 - pulse * 5,
        149 + pulse * 11,
        -17 + pulse * 5,
      );
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.fillStyle = resolveHorseColor(rules.arklioSpalva);
    this.ctx.fillRect(-68, -26, 136, 52);

    if (isHolding) {
      this.ctx.fillStyle = 'rgba(255, 237, 173, 0.4)';
      this.ctx.fillRect(-72, -30, 144, 60);
    }

    const tailBaseX = -68;
    const tailBaseY = -8;
    const tailSwing = sleeping
      ? Math.sin(t * 1.3) * 2.5
      : Math.sin(t * (mood === 'UZSIVEDIMAS' ? 14 : 9)) * (mood === 'PRALEISTA' ? 14 : 9);
    this.ctx.strokeStyle = resolveHorseColor(rules.karciuSpalva);
    this.ctx.lineWidth = 8;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(tailBaseX, tailBaseY);
    this.ctx.quadraticCurveTo(
      -96,
      tailBaseY + 20 + tailSwing * 0.35,
      -108,
      tailBaseY + 42 + tailSwing,
    );
    this.ctx.stroke();

    const neckBob = 0;
    this.ctx.fillStyle = '#c79f76';
    this.ctx.fillRect(50, -46 + neckBob, 30, 40);
    this.ctx.fillRect(65, -53, 14, 12);
    this.ctx.fillRect(80, -40, 26, 26);
    this.ctx.fillRect(100, -35, 10, 16);

    // Funny googly eye for a playful horse expression.
    const eyeCenterX = 70;
    const eyeCenterY = -28 + neckBob * 0.25;
    const eyeRadius = 8.5;
    const pupilRadius = mood === 'PRALEISTA' ? 3.8 : 3.2;
    const wobbleStrength = isHolding ? 1 : 0.32;
    const wobbleX =
      (Math.sin(t * 12 + (isHolding ? 1.1 : 0)) * 2.1 + Math.sin(t * 21) * 0.9) * wobbleStrength;
    const wobbleY =
      (Math.cos(t * 9 + (mood === 'UZSIVEDIMAS' ? 1.7 : 0.4)) * 1.8 + Math.sin(t * 16) * 0.5) *
      wobbleStrength;
    this.ctx.fillStyle = '#fffdf7';
    this.ctx.beginPath();
    this.ctx.arc(eyeCenterX, eyeCenterY, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#5a4228';
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();
    if (sleeping) {
      this.ctx.strokeStyle = '#4a5f86';
      this.ctx.lineWidth = 2.3;
      this.ctx.beginPath();
      this.ctx.moveTo(63, eyeCenterY);
      this.ctx.quadraticCurveTo(70, eyeCenterY + 2.2, 77, eyeCenterY);
      this.ctx.stroke();
      this.ctx.fillStyle = 'rgba(209, 237, 255, 0.9)';
      this.ctx.font = '700 11px "Space Grotesk", sans-serif';
      this.ctx.fillText('Z', 90, eyeCenterY - 14);
      this.ctx.fillText('z', 98, eyeCenterY - 23);
      this.ctx.fillText('z', 104, eyeCenterY - 31);
    } else {
      this.ctx.fillStyle = resolveHorseColor(rules.akiuSpalva);
      this.ctx.beginPath();
      this.ctx.arc(
        eyeCenterX + Math.max(-2.6, Math.min(2.6, wobbleX)),
        eyeCenterY + Math.max(-2.6, Math.min(2.6, wobbleY)),
        pupilRadius,
        0,
        Math.PI * 2,
      );
      this.ctx.fill();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.beginPath();
      this.ctx.arc(eyeCenterX + 1.2, eyeCenterY - 1.6, 1.4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const legSwing = sleeping
      ? Math.sin(t * 0.45) * 0.9
      : isHolding
        ? Math.sin(t * 12) * 4
        : Math.sin(t * 8) * 6;
    this.ctx.fillStyle = resolveHorseColor(rules.karciuSpalva);
    this.ctx.fillRect(-50, 24, 14, 46 + legSwing);
    this.ctx.fillRect(-10, 24, 14, 46 - legSwing);
    this.ctx.fillRect(20, 24, 14, 46 + legSwing);
    this.ctx.fillRect(52, 24, 14, 46 - legSwing);

    if (rules.suKepure) {
      if (rules.kepuresTipas === 'KAUBOJAUS') {
        this.ctx.fillStyle = '#6a3e1f';
        this.ctx.fillRect(44, -66, 48, 8);
        this.ctx.fillRect(50, -79, 30, 16);
        this.ctx.fillStyle = '#c68a45';
        this.ctx.fillRect(59, -71, 12, 3);
      } else if (rules.kepuresTipas === 'KARUNA') {
        this.ctx.fillStyle = '#f0c73f';
        this.ctx.fillRect(55, -66, 28, 8);
        this.ctx.beginPath();
        this.ctx.moveTo(55, -66);
        this.ctx.lineTo(59, -79);
        this.ctx.lineTo(65, -66);
        this.ctx.lineTo(69, -80);
        this.ctx.lineTo(74, -66);
        this.ctx.lineTo(79, -78);
        this.ctx.lineTo(83, -66);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.fillStyle = '#fff2a0';
        this.ctx.fillRect(67, -76, 3, 3);
      } else if (rules.kepuresTipas === 'RAGANOS') {
        this.ctx.fillStyle = '#3f2f6e';
        this.ctx.fillRect(48, -64, 40, 7);
        this.ctx.beginPath();
        this.ctx.moveTo(56, -64);
        this.ctx.lineTo(66, -92);
        this.ctx.lineTo(77, -64);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.fillStyle = '#9b6cff';
        this.ctx.fillRect(57, -67, 21, 3);
      } else {
        this.ctx.fillStyle = '#2d3a63';
        this.ctx.fillRect(46, -64, 42, 12);
        this.ctx.fillRect(56, -77, 22, 14);
        this.ctx.fillRect(82, -62, 20, 6);
      }
    }

    this.drawNoteParticles(dtSec, mood, isHolding, holdingLane);

    this.ctx.restore();
    this.ctx.restore();
    this.ctx.shadowBlur = 0;
  }
}
