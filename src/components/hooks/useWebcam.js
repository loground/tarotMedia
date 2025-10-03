// hooks/useWebcam.js
import { useEffect, useRef, useState } from 'react';

export default function useWebcam(userConstraints) {
  const [videoEl, setVideoEl] = useState(null);
  const streamRef = useRef(null);

  // Make constraints stable across renders (use a ref for default)
  const defaultConstraintsRef = useRef({ video: { facingMode: 'user' }, audio: false });
  const constraints = userConstraints || defaultConstraintsRef.current;

  useEffect(() => {
    let live = true;

    const el = document.createElement('video');
    el.autoplay = true;
    el.playsInline = true;
    el.muted = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!live) return;

        streamRef.current = stream;
        el.srcObject = stream;

        const start = () => {
          // Play only when we actually have data
          if (el.readyState >= 2) el.play().catch(() => {});
        };

        el.addEventListener('loadeddata', start, { once: true });
        setVideoEl(el);
      } catch (e) {
        console.error('getUserMedia failed', e);
        setVideoEl(null);
      }
    })();

    return () => {
      live = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // IMPORTANT: run only once unless you purposely pass a new userConstraints ref
  }, []); // <-- not [constraints]!

  return videoEl;
}
