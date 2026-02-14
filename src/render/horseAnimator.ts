import type { HorseMood } from '../core/types';
import type { DanceRules } from '../core/types';

function getLogicalCanvasSize(
  canvas: HTMLCanvasElement,
  dprScale: number,
): { width: number; height: number } {
  const safeScale = Math.max(1, dprScale);
  const width = Math.max(1, Math.round(canvas.width / safeScale));
  const height = Math.max(1, Math.round(canvas.height / safeScale));
  return { width, height };
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
    arklioSpalva: string;
    karciuSpalva: string;
    suKepure: boolean;
    kepuresTipas: string;
    oroEfektas: string;
    mood: HorseMood;
  } = {
    arklioSpalva: '#d6b48a',
    karciuSpalva: '#7d4f2d',
    suKepure: false,
    kepuresTipas: 'KLASIKINE',
    oroEfektas: 'SAULETA',
    mood: 'GERAI',
  };

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

  private drawEnvironment(t: number, w: number, h: number, rules: DanceRules): void {
    const sky = this.ctx.createLinearGradient(0, 0, 0, h * 0.62);
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
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, w, h);

    const hill = this.ctx.createLinearGradient(0, h * 0.58, 0, h);
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
    this.ctx.fillStyle = hill;
    this.ctx.beginPath();
    this.ctx.moveTo(0, h * 0.66);
    this.ctx.quadraticCurveTo(w * 0.28, h * 0.57, w * 0.5, h * 0.66);
    this.ctx.quadraticCurveTo(w * 0.74, h * 0.74, w, h * 0.66);
    this.ctx.lineTo(w, h);
    this.ctx.lineTo(0, h);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle =
      rainy || thunder ? 'rgba(223, 236, 244, 0.32)' : 'rgba(255, 255, 255, 0.52)';
    for (let i = 0; i < 3; i += 1) {
      const cloudX = ((i * 90 + t * 6) % (w + 120)) - 60;
      const cloudY = 18 + i * 14;
      this.ctx.beginPath();
      this.ctx.arc(cloudX, cloudY, 12, 0, Math.PI * 2);
      this.ctx.arc(cloudX + 14, cloudY - 4, 10, 0, Math.PI * 2);
      this.ctx.arc(cloudX + 26, cloudY, 11, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.fillStyle = rainy
      ? 'rgba(42, 83, 54, 0.56)'
      : thunder
        ? 'rgba(36, 63, 43, 0.62)'
        : snowy
          ? 'rgba(178, 191, 204, 0.52)'
          : 'rgba(56, 116, 56, 0.42)';
    this.ctx.fillRect(0, h * 0.76, w, h * 0.24);

    if (thunder) {
      const flash = Math.max(0, Math.sin(t * 7.5)) * Math.max(0, Math.sin(t * 19.2));
      if (flash > 0.55) {
        this.ctx.fillStyle = `rgba(220, 236, 255, ${(flash - 0.55) * 0.52})`;
        this.ctx.fillRect(0, 0, w, h);
      }
    }
  }

  private drawWeather(t: number, w: number, h: number, rules: DanceRules): void {
    if (rules.oroEfektas === 'SAULETA') {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 216, 109, 0.95)';
      this.ctx.beginPath();
      this.ctx.arc(w - 38, 34, 14, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255, 216, 109, 0.7)';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const rayAngle = (i / 8) * Math.PI * 2 + Math.sin(t * 2) * 0.08;
        const x1 = w - 38 + Math.cos(rayAngle) * 20;
        const y1 = 34 + Math.sin(rayAngle) * 20;
        const x2 = w - 38 + Math.cos(rayAngle) * 28;
        const y2 = 34 + Math.sin(rayAngle) * 28;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
      }
      this.ctx.restore();
      return;
    }

    if (rules.oroEfektas === 'LIETINGA') {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(145, 198, 255, 0.62)';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 14; i += 1) {
        const x = ((i * 31 + t * 95) % (w + 40)) - 20;
        const y = ((i * 51 + t * 180) % (h + 30)) - 15;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x - 5, y + 12);
        this.ctx.stroke();
      }
      this.ctx.restore();
      return;
    }

    if (rules.oroEfektas === 'ZAIBAS') {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(153, 206, 255, 0.58)';
      this.ctx.lineWidth = 2.3;
      for (let i = 0; i < 12; i += 1) {
        const x = ((i * 37 + t * 110) % (w + 44)) - 22;
        const y = ((i * 57 + t * 205) % (h + 40)) - 20;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x - 5, y + 13);
        this.ctx.stroke();
      }

      const strikePulse = Math.max(0, Math.sin(t * 6.6)) * Math.max(0, Math.sin(t * 13.8));
      if (strikePulse > 0.62) {
        this.ctx.strokeStyle = `rgba(255, 249, 194, ${0.35 + (strikePulse - 0.62) * 1.1})`;
        this.ctx.lineWidth = 3.2;
        const baseX = w * (0.24 + (Math.sin(t * 1.7) + 1) * 0.5 * 0.52);
        this.ctx.beginPath();
        this.ctx.moveTo(baseX, 14);
        this.ctx.lineTo(baseX - 14, 48);
        this.ctx.lineTo(baseX + 6, 48);
        this.ctx.lineTo(baseX - 16, 92);
        this.ctx.stroke();
      }

      this.ctx.restore();
      return;
    }

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(239, 248, 255, 0.9)';
    for (let i = 0; i < 16; i += 1) {
      const x = ((i * 29 + t * 24) % (w + 30)) - 15;
      const y = ((i * 43 + t * 55) % (h + 20)) - 10;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1.8 + (i % 3) * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  render(
    timeMs: number,
    mood: HorseMood,
    rules: DanceRules,
    isHolding = false,
    holdingLane: number | null = null,
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
    this.drawEnvironment(t, w, h, rules);
    this.drawWeather(t, w, h, rules);

    const fitScale = Math.min(w / 260, h / 210, 0.82);
    const amp = fitScale;
    const centerX = w * 0.5;
    const centerY = h * 0.46;
    const holdPulse = Math.sin(t * 13) * 2.2 * amp;
    const dance = isHolding ? holdPulse : Math.sin(t * 8) * 8 * amp;
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

    this.ctx.fillStyle = rules.arklioSpalva;
    this.ctx.fillRect(-68, -26, 136, 52);

    if (isHolding) {
      this.ctx.fillStyle = 'rgba(255, 237, 173, 0.4)';
      this.ctx.fillRect(-72, -30, 144, 60);
    }

    const tailBaseX = -68;
    const tailBaseY = -8;
    const tailSwing =
      Math.sin(t * (mood === 'UZSIVEDIMAS' ? 14 : 9)) * (mood === 'PRALEISTA' ? 14 : 9);
    this.ctx.strokeStyle = rules.karciuSpalva;
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
    this.ctx.fillStyle = '#2b1f12';
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

    const legSwing = isHolding ? Math.sin(t * 12) * 4 : Math.sin(t * 8) * 6;
    this.ctx.fillStyle = rules.karciuSpalva;
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
