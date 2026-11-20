import type { ISeriesPrimitive, IPrimitivePaneView, IPrimitivePaneRenderer, SeriesAttachedParameter, Time } from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import { paintShapes, Shape } from './drawingScene';

/**
 * Series primitive that paints the chart overlay (drawings, setup signals) on the chart's own
 * canvas. Lightweight Charts calls draw() inside its paint, after the viewport moved, so the
 * overlay never lags a pan or zoom by a frame. `afterPaint` runs at the end of each paint with
 * the same fresh coordinates, for the few HTML elements (order tags) that must follow the chart.
 */
export class OverlayPrimitive implements ISeriesPrimitive<Time> {
  private request: (() => void) | null = null;
  private readonly views: readonly IPrimitivePaneView[];

  constructor(
    private scene: (w: number, h: number) => Shape[],
    private afterPaint?: () => void,
  ) {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target: CanvasRenderingTarget2D) => {
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          context.save();
          context.beginPath();
          context.rect(0, 0, mediaSize.width, mediaSize.height);
          context.clip();
          paintShapes(context, this.scene(mediaSize.width, mediaSize.height));
          context.restore();
        });
        this.afterPaint?.();
      },
    };
    this.views = [{ renderer: () => renderer, zOrder: () => 'top' }];
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.request = p.requestUpdate;
  }
  detached() {
    this.request = null;
  }
  paneViews() {
    return this.views;
  }
  /** Repaint after the overlay's own state changed (a drawing moved, a signal arrived). */
  update() {
    this.request?.();
  }
}
