// components/HandRotateController.jsx
import { useEffect, useRef } from 'react';
import { Hands } from '@mediapipe/hands';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;

export default function HandRotateController({
  video,
  anchorRef,
  zoomRef, // ← new
  maxYaw = Math.PI * 0.35,
  maxPitch = 0.35,
  pinchRange = [0.15, 0.7], // normalized thumb–index distance (closed → open)
  zoomRange = [0.85, 1.35], // resulting zoom factor (out → in)
}) {
  const targetRot = useRef({ x: -0.09, y: 0 });
  const handsRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    hands.onResults((results) => {
      const lm = results.multiHandLandmarks?.[0];

      // --- Rotation (unchanged idea) ---
      if (lm) {
        let cx = 0,
          cy = 0;
        for (let i = 0; i < lm.length; i++) {
          cx += lm[i].x;
          cy += lm[i].y;
        }
        cx /= lm.length;
        cy /= lm.length;

        const nx = clamp((0.5 - cx) * 2, -1, 1); // flip X for natural feel
        const ny = clamp((cy - 0.5) * 2, -1, 1);
        const yaw = nx * maxYaw;
        const pitch = ny * maxPitch;

        targetRot.current.y = lerp(targetRot.current.y, yaw, 0.25);
        targetRot.current.x = lerp(targetRot.current.x, pitch, 0.25);
      } else {
        targetRot.current.y = lerp(targetRot.current.y, 0, 0.08);
        targetRot.current.x = lerp(targetRot.current.x, -0.09, 0.08);
      }

      // --- Pinch → Zoom (thumb tip 4, index tip 8), normalized by palm width (5–17) ---
      if (zoomRef) {
        let zTarget = 1;
        if (lm) {
          const pinch = dist(lm[4], lm[8]);
          const palm = dist(lm[5], lm[17]) + 1e-6;
          const r = clamp(pinch / palm, pinchRange[0], pinchRange[1]); // 0.15..0.70 typical
          const t = (r - pinchRange[0]) / (pinchRange[1] - pinchRange[0]); // 0..1
          // t=0 (fingers closed) → zoomRange[0] (zoom out)
          // t=1 (fingers open)   → zoomRange[1] (zoom in)
          zTarget = zoomRange[0] + t * (zoomRange[1] - zoomRange[0]);
        }
        // smooth & clamp
        const next = lerp(zoomRef.current ?? 1, zTarget, 0.2);
        zoomRef.current = clamp(next, zoomRange[0], zoomRange[1]);
      }
    });

    handsRef.current = hands;
    return () => {
      handsRef.current = null;
      cancelAnimationFrame(rafRef.current);
    };
  }, [maxYaw, maxPitch, pinchRange, zoomRange, zoomRef]);

  // Feed frames safely
  useEffect(() => {
    if (!video || !handsRef.current) return;
    let running = true;

    const loop = async () => {
      if (!running) return;
      if (video.readyState >= 2 && !video.paused && !video.ended) {
        try {
          await handsRef.current.send({ image: video });
        } catch {}
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    if (video.readyState >= 2) loop();
    else video.addEventListener('loadeddata', loop, { once: true });

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [video]);

  // Apply rotation to anchor
  useEffect(() => {
    let raf;
    const tick = () => {
      const a = anchorRef?.current;
      if (a) {
        a.rotation.y = lerp(a.rotation.y, targetRot.current.y, 0.15);
        a.rotation.x = lerp(a.rotation.x, targetRot.current.x, 0.15);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anchorRef]);

  return null;
}
