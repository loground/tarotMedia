// components/HandRotateController.jsx
// 'use client'; // <= If you're on Next.js app router, keep this at the top.

import { useEffect, useRef } from 'react';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;

export default function HandRotateController({
  video,
  anchorRef,
  zoomRef,
  maxYaw = Math.PI * 0.35,
  maxPitch = 0.35,
  pinchRange = [0.15, 0.7],
  zoomRange = [0.85, 1.35],
}) {
  const targetRot = useRef({ x: -0.09, y: 0 });
  const handsRef = useRef(null);
  const rafRef = useRef(0);

  // init MediaPipe Hands via dynamic import (prod-safe)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // ⚠️ dynamic import avoids SSR/interop issues
      const mod = await import('@mediapipe/hands');
      const HandsCtor = mod?.Hands || mod?.default?.Hands; // guard different bundlers

      if (!HandsCtor) {
        console.error('MediaPipe Hands constructor not found', mod);
        return;
      }

      const hands = new HandsCtor({
        // pin a version to avoid CDN redirects changing file layout
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
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

        if (lm) {
          let cx = 0,
            cy = 0;
          for (let i = 0; i < lm.length; i++) {
            cx += lm[i].x;
            cy += lm[i].y;
          }
          cx /= lm.length;
          cy /= lm.length;

          const nx = clamp((0.5 - cx) * 2, -1, 1);
          const ny = clamp((cy - 0.5) * 2, -1, 1);
          const yaw = nx * maxYaw;
          const pitch = ny * maxPitch;

          targetRot.current.y = lerp(targetRot.current.y, yaw, 0.25);
          targetRot.current.x = lerp(targetRot.current.x, pitch, 0.25);

          if (zoomRef) {
            const pinch = dist(lm[4], lm[8]);
            const palm = dist(lm[5], lm[17]) + 1e-6;
            const r = clamp(pinch / palm, pinchRange[0], pinchRange[1]);
            const t = (r - pinchRange[0]) / (pinchRange[1] - pinchRange[0]);
            const zTarget = zoomRange[0] + t * (zoomRange[1] - zoomRange[0]);
            const next = lerp(zoomRef.current ?? 1, zTarget, 0.2);
            zoomRef.current = clamp(next, zoomRange[0], zoomRange[1]);
          }
        } else {
          targetRot.current.y = lerp(targetRot.current.y, 0, 0.08);
          targetRot.current.x = lerp(targetRot.current.x, -0.09, 0.08);
        }
      });

      if (!cancelled) handsRef.current = hands;
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      try {
        handsRef.current?.close?.();
      } catch {}
      handsRef.current = null;
    };
  }, [maxYaw, maxPitch, pinchRange, zoomRange, zoomRef]);

  // feed frames
  useEffect(() => {
    if (!video) return;
    let running = true;

    const loop = async () => {
      if (!running) return;
      const h = handsRef.current;
      if (h && video.readyState >= 2 && !video.paused && !video.ended) {
        try {
          await h.send({ image: video });
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

  // apply rotation to anchor
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
