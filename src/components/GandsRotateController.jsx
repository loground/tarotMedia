// components/HandRotateController.jsx
// (no 'use client' needed for Vite; keep this as a regular client component)

import { useEffect, useRef } from 'react';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;

// ESM dynamic import with optional CDN UMD fallback
async function loadHandsCtor() {
  try {
    const mp = await import('@mediapipe/hands');
    const ctor = mp?.Hands || mp?.default?.Hands;
    if (typeof ctor === 'function') return ctor;
  } catch (e) {
    console.warn('ESM import of @mediapipe/hands failed, falling back to CDN UMD:', e);
  }
  // Fallback to UMD
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js';
    s.async = true;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.Hands || null;
}

export default function HandRotateController({
  video,
  anchorRef,
  zoomRef,
  navRef,

  maxYaw = Math.PI * 0.35,
  maxPitch = 0.35,
  pinchRange = [0.15, 0.7],
  zoomRange = [0.5, 1.35],

  // swipe tuning (normalized X in [-1..1])
  swipeWindowMs = 420,
  swipeDisplacement = 0.35,
  swipeMinSpeed = 1.0,
  swipeCooldownMs = 700,
  swipeRequireOpenHand = true,
}) {
  const targetRot = useRef({ x: -0.09, y: 0 });
  const handsRef = useRef(null);
  const rafRef = useRef(0);

  const xSmoothRef = useRef(0);
  const prevXRef = useRef(0);
  const prevTRef = useRef(0);
  const samplesRef = useRef([]);
  const lastSwipeAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const HandsCtor = await loadHandsCtor();
      if (typeof HandsCtor !== 'function') {
        console.error('MediaPipe Hands constructor not found');
        return;
      }

      // IMPORTANT: instantiate the resolved constructor, not a top-level import
      const hands = new HandsCtor({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

      const trySwipe = (now, xSmooth, pinchRatio) => {
        const arr = samplesRef.current;
        arr.push({ t: now, x: xSmooth });
        const cutoff = now - swipeWindowMs;
        while (arr.length && arr[0].t < cutoff) arr.shift();
        if (arr.length < 2) return;

        const dx = xSmooth - arr[0].x;
        const dt = Math.max(1e-3, (now - (prevTRef.current || now)) / 1000);
        const instSpeed = Math.abs((xSmooth - prevXRef.current) / dt);
        const openEnough = !swipeRequireOpenHand || pinchRatio > 0.38;

        if (now - lastSwipeAt.current < swipeCooldownMs) return;

        if (openEnough && instSpeed >= swipeMinSpeed) {
          if (dx >= swipeDisplacement) {
            navRef?.current?.next?.();
            lastSwipeAt.current = now;
            samplesRef.current = [];
          } else if (dx <= -swipeDisplacement) {
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

          const pinch = dist(lm[4], lm[8]);
          const palm = dist(lm[5], lm[17]) + 1e-6;
          const pinchRatio = clamp(pinch / palm, pinchRange[0], pinchRange[1]);

          if (zoomRef) {
            const t = (pinchRatio - pinchRange[0]) / (pinchRange[1] - pinchRange[0]);
            const zTarget = zoomRange[0] + t * (zoomRange[1] - zoomRange[0]);
            const next = lerp(zoomRef.current ?? 1, zTarget, 0.2);
            zoomRef.current = clamp(next, zoomRange[0], zoomRange[1]);
          }

          const now = performance.now();
          xSmoothRef.current = lerp(xSmoothRef.current, nx, 0.35);
          trySwipe(now, xSmoothRef.current, pinchRatio);
        } else {
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
