// components/GandsRotateController.jsx
// (drop-in) — stable hand rotation + optional pinch zoom; zero impact on webcam FPS.

import { useEffect, useRef } from 'react';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;

// Dynamically load MediaPipe Hands (ESM, then CDN UMD fallback)
async function loadHandsCtor() {
  try {
    const mp = await import('@mediapipe/hands');
    const ctor = mp?.Hands || mp?.default?.Hands;
    if (typeof ctor === 'function') return ctor;
  } catch {}
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
  video, // HTMLVideoElement from your webcam hook
  anchorRef, // THREE.Group you want to rotate
  zoomRef, // mutable ref number
  navRef, // (kept for your API; swipe disabled here)
  maxYaw = Math.PI * 0.35, // horizontal rotation range
  maxPitch = 0.35, // vertical rotation range
  pinchRange = [0.15, 0.7],
  zoomRange = [0.5, 1.35],
  fps = 30, // process this many frames per second (prevents jank)
  smooth = 0.22, // rotation lerp factor each raf
}) {
  const handsRef = useRef(null);
  const rafProcessRef = useRef(0);
  const rafApplyRef = useRef(0);
  const lastProcessAt = useRef(0);

  const targetRot = useRef({ x: -0.09, y: 0 }); // desired rotation set by ML
  const haveHandsRef = useRef(false);

  // ---- HELPER: distance between landmarks
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---- INIT + TEARDOWN
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const HandsCtor = await loadHandsCtor();
      if (cancelled || typeof HandsCtor !== 'function') return;

      const hands = new HandsCtor({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      hands.onResults((res) => {
        const lm = res?.multiHandLandmarks?.[0];
        if (!lm) {
          haveHandsRef.current = false;
          return;
        }
        // avg center of hand (normalized 0..1)
        let cx = 0,
          cy = 0;
        for (let i = 0; i < lm.length; i++) {
          cx += lm[i].x;
          cy += lm[i].y;
        }
        cx /= lm.length;
        cy /= lm.length;

        // map center to yaw/pitch
        const nx = clamp((0.5 - cx) * 2, -1, 1); // left/right
        const ny = clamp((cy - 0.5) * 2, -1, 1); // up/down
        const yaw = nx * maxYaw;
        const pitch = ny * maxPitch;

        // set targets
        targetRot.current.y = yaw;
        targetRot.current.x = pitch;

        // pinch zoom
        if (zoomRef) {
          const pinch = dist(lm[4], lm[8]);
          const palm = dist(lm[5], lm[17]) + 1e-6;
          const ratio = clamp(pinch / palm, pinchRange[0], pinchRange[1]);
          const t = (ratio - pinchRange[0]) / (pinchRange[1] - pinchRange[0]);
          const z = zoomRange[0] + t * (zoomRange[1] - zoomRange[0]);
          // gentle smoothing on zoom
          const cur = zoomRef.current ?? 1;
          const next = cur + (z - cur) * 0.18;
          zoomRef.current = clamp(next, zoomRange[0], zoomRange[1]);
        }

        haveHandsRef.current = true;
      });

      if (!cancelled) handsRef.current = hands;
    })();

    return () => {
      cancelled = true;
    };
  }, [maxYaw, maxPitch, pinchRange, zoomRange]);

  // ---- PROCESS LOOP (sends frames to MediaPipe) — throttled
  useEffect(() => {
    if (!video) return;
    let running = true;

    const loop = async () => {
      if (!running) return;
      const now = performance.now();
      const minInterval = 1000 / Math.max(1, fps);

      // Only process if: hands exists, video has frames, and we're within FPS budget
      const hands = handsRef.current;
      if (
        hands &&
        video.readyState >= 2 &&
        !video.paused &&
        !video.ended &&
        now - lastProcessAt.current >= minInterval
      ) {
        try {
          lastProcessAt.current = now;
          // IMPORTANT: send the HTMLVideoElement directly
          await hands.send({ image: video });
        } catch {
          // Ignore intermittent send errors
        }
      }
      rafProcessRef.current = requestAnimationFrame(loop);
    };

    // Wait until the video is truly playing/has dimensions
    const start = () => {
      if (!running) return;
      cancelAnimationFrame(rafProcessRef.current);
      rafProcessRef.current = requestAnimationFrame(loop);
    };

    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      start();
    } else {
      const once = () => start();
      video.addEventListener('loadeddata', once, { once: true });
      video.addEventListener('playing', once, { once: true });
    }

    return () => {
      running = false;
      cancelAnimationFrame(rafProcessRef.current);
    };
  }, [video, fps]);

  // ---- APPLY LOOP (smoothly apply target rotation to anchor)
  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;
      const a = anchorRef?.current;
      if (a) {
        // Make sure we never fight other code paths
        a.rotation.order = 'YXZ';
        const tr = targetRot.current;

        // If no hands detected recently, ease back to neutral pitch, keep yaw gentle
        const xTarget = haveHandsRef.current ? tr.x : -0.09;
        const yTarget = haveHandsRef.current ? tr.y : a.rotation.y * 0.9;

        a.rotation.x = lerp(a.rotation.x, xTarget, smooth);
        a.rotation.y = lerp(a.rotation.y, yTarget, smooth);
      }
      rafApplyRef.current = requestAnimationFrame(tick);
    };

    rafApplyRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafApplyRef.current);
    };
  }, [anchorRef, smooth]);

  // ---- CLEAN UP hands instance on unmount
  useEffect(() => {
    return () => {
      try {
        handsRef.current?.close?.();
      } catch {}
      handsRef.current = null;
    };
  }, []);

  return null;
}
