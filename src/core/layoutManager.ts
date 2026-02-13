export interface LayoutMetrics {
  width: number;
  height: number;
  dpr: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function buildLayoutMetrics(width: number, height: number, dpr: number): LayoutMetrics {
  const safeDpr = Math.max(1, dpr);
  const canvasWidth = Math.max(160, Math.floor(width));
  const canvasHeight = Math.max(110, Math.floor(height));

  return {
    width: canvasWidth,
    height: canvasHeight,
    dpr: safeDpr,
    canvasWidth: Math.floor(canvasWidth * safeDpr),
    canvasHeight: Math.floor(canvasHeight * safeDpr),
  };
}
