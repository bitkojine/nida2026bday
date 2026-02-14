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
  private lastVisualState: {
    arklioSpalva: string;
    karciuSpalva: string;
    suKepure: boolean;
    oroEfektas: string;
    mood: HorseMood;
  } = {
    arklioSpalva: '#d6b48a',
    karciuSpalva: '#7d4f2d',
    suKepure: false,
    oroEfektas: 'SAULETA',
    mood: 'GERAI',
  };

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  getVisualState(): {
    arklioSpalva: string;
    karciuSpalva: string;
    suKepure: boolean;
    oroEfektas: string;
    mood: HorseMood;
  } {
    return { ...this.lastVisualState };
  }

  private drawEnvironment(t: number, w: number, h: number, rules: DanceRules): void {
    const sky = this.ctx.createLinearGradient(0, 0, 0, h * 0.62);
    const rainy = rules.oroEfektas === 'LIETINGA';
    const snowy = rules.oroEfektas === 'SNIEGAS';
    if (rainy) {
      sky.addColorStop(0, '#4f6478');
      sky.addColorStop(0.55, '#6f8598');
      sky.addColorStop(1, '#8ea0af');
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

    this.ctx.fillStyle = rainy ? 'rgba(223, 236, 244, 0.32)' : 'rgba(255, 255, 255, 0.52)';
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
      : snowy
        ? 'rgba(178, 191, 204, 0.52)'
        : 'rgba(56, 116, 56, 0.42)';
    this.ctx.fillRect(0, h * 0.76, w, h * 0.24);
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

  render(timeMs: number, mood: HorseMood, rules: DanceRules): void {
    const { canvas } = this.ctx;
    const scaleX = Math.max(1, this.ctx.getTransform().a || 1);
    const logical = getLogicalCanvasSize(canvas, scaleX);
    const w = logical.width;
    const h = logical.height;
    const t = timeMs / 1000;
    this.lastVisualState = {
      arklioSpalva: rules.arklioSpalva,
      karciuSpalva: rules.karciuSpalva,
      suKepure: rules.suKepure,
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
    const dance = Math.sin(t * 8) * 8 * amp;
    const stumble = mood === 'PRALEISTA' ? Math.sin(t * 18) * 14 * amp : 0;
    const boost = mood === 'UZSIVEDIMAS' ? 1.16 : 1;

    if (mood === 'TOBULA' || mood === 'UZSIVEDIMAS') {
      this.ctx.shadowBlur = mood === 'UZSIVEDIMAS' ? 30 : 16;
      this.ctx.shadowColor = '#ffd166';
    } else {
      this.ctx.shadowBlur = 0;
    }

    this.ctx.save();
    this.ctx.translate(centerX + stumble, centerY + dance);
    this.ctx.scale(boost * fitScale, boost * fitScale);

    this.ctx.fillStyle = rules.arklioSpalva;
    this.ctx.fillRect(-68, -26, 136, 52);

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

    this.ctx.fillStyle = '#c79f76';
    this.ctx.fillRect(50, -46, 30, 40);
    this.ctx.fillRect(65, -53, 14, 12);
    this.ctx.fillRect(80, -40, 26, 26);
    this.ctx.fillRect(100, -35, 10, 16);

    this.ctx.fillStyle = rules.karciuSpalva;
    this.ctx.fillRect(-50, 24, 14, 46 + Math.sin(t * 8) * 6);
    this.ctx.fillRect(-10, 24, 14, 46 - Math.sin(t * 8) * 6);
    this.ctx.fillRect(20, 24, 14, 46 + Math.sin(t * 8) * 6);
    this.ctx.fillRect(52, 24, 14, 46 - Math.sin(t * 8) * 6);

    if (rules.suKepure) {
      this.ctx.fillStyle = '#2d3a63';
      this.ctx.fillRect(46, -64, 42, 12);
      this.ctx.fillRect(56, -77, 22, 14);
      this.ctx.fillRect(82, -62, 20, 6);
    }

    this.ctx.restore();
    this.ctx.restore();
    this.ctx.shadowBlur = 0;
  }
}
