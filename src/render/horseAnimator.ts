import type { HorseMood } from '../core/types';
import type { DanceRules } from '../core/types';

function getLogicalCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const ratioX = cssWidth > 0 ? canvas.width / cssWidth : 1;
  const ratioY = cssHeight > 0 ? canvas.height / cssHeight : 1;

  return {
    width: canvas.width / Math.max(1, ratioX),
    height: canvas.height / Math.max(1, ratioY),
  };
}

export class HorseAnimator {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(timeMs: number, mood: HorseMood, rules: DanceRules): void {
    const { canvas } = this.ctx;
    const logical = getLogicalCanvasSize(canvas);
    const w = logical.width;
    const h = logical.height;
    const t = timeMs / 1000;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = '#110d18';
    this.ctx.fillRect(0, 0, w, h);

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

    this.ctx.fillStyle = '#c79f76';
    this.ctx.fillRect(50, -46, 30, 40);
    this.ctx.fillRect(65, -53, 14, 12);

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
    this.ctx.shadowBlur = 0;
  }
}
