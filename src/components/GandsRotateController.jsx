// components/HandRotateController.jsx
// 'use client';

import { useEffect, useRef } from 'react';
import { Hands, HAND_CONNECTIONS, Results } from '@mediapipe/hands';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;

export default function HandRotateController({
  video,
  anchorRef,
  zoomRef,
  navRef, // ✅ NEW: to call next()/prev()

  maxYaw = Math.PI * 0.35,
  maxPitch = 0.35,
  pinchRange = [0.15, 0.7],
  zoomRange = [0.5, 1.35],

  // ✅ Swipe tuning (all normalized to [-1..1] X)
  swipeWindowMs = 420, // lookback window to measure displacement
  swipeDisplacement = 1, // how far across X in that window to count as swipe
  swipeMinSpeed = 0.2, // |dx/dt| (units/sec) to reject slow drifts
  swipeCooldownMs = 100, // debounce between swipes
  swipeRequireOpenHand = true, // require open-ish hand (not pinched) to swipe
}) {
  const targetRot = useRef({ x: -0.09, y: 0 });
  const handsRef = useRef(null);
  const rafRef = useRef(0);

  // ✅ swipe state
  const xSmoothRef = useRef(0); // low-pass filtered hand center X [-1..1]
  const prevXRef = useRef(0);
  const prevTRef = useRef(0);
  const samplesRef = useRef([]); // [{t, x}] within window
  const lastSwipeAt = useRef(0);

  // init MediaPipe Hands via dynamic import (prod-safe)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mod = await import('@mediapipe/hands');
      const HandsCtor = mod?.Hands || mod?.default?.Hands;
      if (!HandsCtor) {
        console.error('MediaPipe Hands constructor not found', mod);
        return;
      }

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

      const trySwipe = (now, xSmooth, pinchRatio) => {
        // Keep window to ~swipeWindowMs
        const arr = samplesRef.current;
        arr.push({ t: now, x: xSmooth });
        const cutoff = now - swipeWindowMs;
        while (arr.length && arr[0].t < cutoff) arr.shift();

        if (arr.length < 2) return;

        const dx = xSmooth - arr[0].x; // displacement over window
        const dt = Math.max(1e-3, (now - (prevTRef.current || now)) / 1000);
        const instSpeed = Math.abs((xSmooth - prevXRef.current) / dt); // units/sec

        const openEnough = !swipeRequireOpenHand || pinchRatio > 0.38; // tweak

        // Cooldown
        if (now - lastSwipeAt.current < swipeCooldownMs) return;

        if (openEnough && instSpeed >= swipeMinSpeed) {
          if (dx >= swipeDisplacement) {
            // left -> right swipe → NEXT
            navRef?.current?.next?.();
            lastSwipeAt.current = now;
            // reset window to avoid double-fire on same motion
            samplesRef.current = [];
          } else if (dx <= -swipeDisplacement) {
            // right -> left swipe → PREV
            navRef?.current?.prev?.();
            lastSwipeAt.current = now;
            samplesRef.current = [];
          }
        }

        prevXRef.current = xSmooth;
        prevTRef.current = now;
      };

      hands.onResults((results) => {
        const lm = results.multiHandLandmarks?.[0];

        if (lm) {
          // center (average of landmarks)
          let cx = 0,
            cy = 0;
          for (let i = 0; i < lm.length; i++) {
            cx += lm[i].x;
            cy += lm[i].y;
          }
          cx /= lm.length;
          cy /= lm.length;

          // normalized to [-1..1]
          const nx = clamp((0.5 - cx) * 2, -1, 1);
          const ny = clamp((cy - 0.5) * 2, -1, 1);

          // rotation target
          const yaw = nx * maxYaw;
          const pitch = ny * maxPitch;
          targetRot.current.y = lerp(targetRot.current.y, yaw, 0.25);
          targetRot.current.x = lerp(targetRot.current.x, pitch, 0.25);

          // zoom via pinch ratio
          const pinch = dist(lm[4], lm[8]);
          const palm = dist(lm[5], lm[17]) + 1e-6;
          const pinchRatio = clamp(pinch / palm, pinchRange[0], pinchRange[1]);

          if (zoomRef) {
            const t = (pinchRatio - pinchRange[0]) / (pinchRange[1] - pinchRange[0]);
            const zTarget =
              zoomRange[0] + t * (zoomRange[1] - zoomRange[1] + 0 || zoomRange[1] - zoomRange[0]);
            const next = lerp(
              zoomRef.current ?? 1,
              zoomRange[0] + t * (zoomRange[1] - zoomRange[0]),
              0.2,
            );
            zoomRef.current = clamp(next, zoomRange[0], zoomRange[1]);
          }

          // ✅ swipe detection (low-pass + windowed displacement + speed + cooldown)
          const now = performance.now();
          xSmoothRef.current = lerp(xSmoothRef.current, nx, 0.35); // low-pass
          trySwipe(now, xSmoothRef.current, pinchRatio);
        } else {
          // relax back to idle pose when no hand
          targetRot.current.y = lerp(targetRot.current.y, 0, 0.08);
          targetRot.current.x = lerp(targetRot.current.x, -0.09, 0.08);
          samplesRef.current = [];
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
      samplesRef.current = [];
    };
  }, [
    maxYaw,
    maxPitch,
    pinchRange,
    zoomRange,
    navRef,
    swipeWindowMs,
    swipeDisplacement,
    swipeMinSpeed,
    swipeCooldownMs,
    swipeRequireOpenHand,
  ]);

  // feed frames to MediaPipe
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
