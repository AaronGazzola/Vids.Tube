import type { OverlayBox } from "@/lib/demo-overlay";
import { goalDiameter, OVERLAY_CANVAS_CENTRE } from "@/lib/demo-overlay";

// How far an announcement has to travel from the middle of the broadcast to the
// goal overlay it belongs to.
//
// Worked out in canvas coordinates rather than by measuring the DOM. The stage
// already holds every box's position and scale on a fixed 1080x1920 canvas, and
// that canvas is itself scaled to whatever is displaying it — so a measured
// pixel would be the wrong pixel on the Overlays tab, while a canvas coordinate
// is right on both surfaces.
//
// The box's own coordinates are its top-left corner, and it is scaled from that
// corner, so the drawn centre is half a scaled diameter in on each axis.
export function goalFlightDelta(
  box: OverlayBox,
  height?: number
): { dx: number; dy: number } {
  const radius = (goalDiameter(height) * box.scale) / 2;
  return {
    dx: box.x + radius - OVERLAY_CANVAS_CENTRE.x,
    dy: box.y + radius - OVERLAY_CANVAS_CENTRE.y,
  };
}
