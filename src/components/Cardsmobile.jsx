// components/CardsMobile.jsx
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

const CARD_W = 5;
const CARD_H = 7;
const CARD_D = 0.15;

const BASE_SCALE = 36;
const SLIDE_X = CARD_W * 0.5;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function CardsMobile({ anchorRef: externalAnchorRef, zoomRef, navRef }) {
  const COUNT = 20;
  const urls = useMemo(
    () => Array.from({ length: COUNT }, (_, i) => `/tarot/tarot${i + 1}.jpg`),
    [COUNT],
  );
  return (
    <MobileCarousel urls={urls} anchorRef={externalAnchorRef} zoomRef={zoomRef} navRef={navRef} />
  );
}

function MobileCarousel({ urls, anchorRef: externalAnchorRef, zoomRef, navRef }) {
  const internalAnchor = useRef();
  const anchor = externalAnchorRef || internalAnchor;

  const meshA = useRef();
  const meshB = useRef();
  const matsA = useRef(null);
  const matsB = useRef(null);

  const currentIsA = useRef(true);
  const indexRef = useRef(0);
  const readyRef = useRef(false);
  const anim = useRef({ playing: false, t: 0, dir: 0, dur: 0.3, setIndex: null });

  const loaderRef = useRef(null);
  if (!loaderRef.current) {
    const privateManager = new THREE.LoadingManager();
    loaderRef.current = new THREE.TextureLoader(privateManager);
  }

  const cache = useRef(new Map());
  const loadTexture = useCallback((url) => {
    if (cache.current.has(url)) return Promise.resolve(cache.current.get(url));
    return new Promise((res, rej) => {
      loaderRef.current.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.anisotropy = 2;
          cache.current.set(url, tex);
          res(tex);
        },
        undefined,
        rej,
      );
    });
  }, []);

  const setOpacity = (trio, o) => {
    if (!trio) return;
    trio[0].opacity = o;
    trio[1].opacity = o;
    trio[2].opacity = o;
    const dw = o > 0.99;
    trio[0].depthWrite = dw;
    trio[1].depthWrite = dw;
    trio[2].depthWrite = dw;
    trio[0].transparent = !dw;
    trio[1].transparent = true;
    trio[2].transparent = true;
  };

  const setMaps = (trio, tex) => {
    if (!trio) return;
    trio[1].map = tex;
    trio[1].needsUpdate = true;
    trio[2].map = tex;
    trio[2].needsUpdate = true;
  };

  const makeMats = (tex) => [
    new THREE.MeshStandardMaterial({
      color: '#2a2a2a',
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      map: tex ?? null,
      roughness: 0.45,
      metalness: 0.08,
      transparent: true,
      opacity: 1,
    }),
    new THREE.MeshStandardMaterial({
      map: tex ?? null,
      roughness: 0.45,
      metalness: 0.08,
      transparent: true,
      opacity: 1,
    }),
  ];

  useEffect(() => {
    let live = true;
    (async () => {
      const first = await loadTexture(urls[0]);
      if (!live) return;

      matsA.current = makeMats(first);
      matsB.current = makeMats(first);

      if (meshA.current) {
        meshA.current.material = [
          matsA.current[0],
          matsA.current[0],
          matsA.current[0],
          matsA.current[0],
          matsA.current[1],
          matsA.current[2],
        ];
        meshA.current.position.x = 0;
      }
      if (meshB.current) {
        meshB.current.material = [
          matsB.current[0],
          matsB.current[0],
          matsB.current[0],
          matsB.current[0],
          matsB.current[1],
          matsB.current[2],
        ];
        meshB.current.position.x = SLIDE_X;
      }

      setOpacity(matsA.current, 1);
      setOpacity(matsB.current, 0);

      const prev = urls[(indexRef.current - 1 + urls.length) % urls.length];
      const next = urls[(indexRef.current + 1) % urls.length];
      loadTexture(prev);
      loadTexture(next);

      readyRef.current = true;
    })();
    return () => {
      live = false;
    };
  }, [urls, loadTexture]);

  // existing next/prev
  const go = useCallback(
    async (dir) => {
      if (!readyRef.current || anim.current.playing) return;
      const nextIdx = (indexRef.current + dir + urls.length) % urls.length;
      const tex = cache.current.get(urls[nextIdx]) || (await loadTexture(urls[nextIdx]));

      const incomingMats = (currentIsA.current ? matsB : matsA).current;
      const incomingMesh = (currentIsA.current ? meshB : meshA).current;
      const outgoingMesh = (currentIsA.current ? meshA : meshB).current;

      setMaps(incomingMats, tex);
      setOpacity(incomingMats, 0);
      incomingMesh.position.x = dir * SLIDE_X;
      outgoingMesh.position.x = 0;

      anim.current = { playing: true, t: 0, dir, dur: 0.3, setIndex: null };

      const after = (nextIdx + 1) % urls.length;
      const before = (nextIdx - 1 + urls.length) % urls.length;
      loadTexture(urls[after]);
      loadTexture(urls[before]);
    },
    [loadTexture, urls],
  );

  // NEW: jump straight to any index with one slide anim
  const showIndex = useCallback(
    async (targetIdx, dirOverride) => {
      if (!readyRef.current || anim.current.playing) return;
      let tIdx = ((targetIdx % urls.length) + urls.length) % urls.length;
      if (tIdx === indexRef.current) return;

      // choose direction: shortest way around the ring unless overridden
      const forwardSteps = (tIdx - indexRef.current + urls.length) % urls.length;
      const backwardSteps = urls.length - forwardSteps;
      const dir = dirOverride ?? (forwardSteps <= backwardSteps ? 1 : -1);

      const tex = cache.current.get(urls[tIdx]) || (await loadTexture(urls[tIdx]));

      const incomingMats = (currentIsA.current ? matsB : matsA).current;
      const incomingMesh = (currentIsA.current ? meshB : meshA).current;
      const outgoingMesh = (currentIsA.current ? meshA : meshB).current;

      setMaps(incomingMats, tex);
      setOpacity(incomingMats, 0);
      incomingMesh.position.x = dir * SLIDE_X;
      outgoingMesh.position.x = 0;

      anim.current = { playing: true, t: 0, dir, dur: 0.3, setIndex: tIdx };

      const after = (tIdx + 1) % urls.length;
      const before = (tIdx - 1 + urls.length) % urls.length;
      loadTexture(urls[after]);
      loadTexture(urls[before]);
    },
    [loadTexture, urls],
  );

  // expose controls to outside
  useEffect(() => {
    if (!navRef) return;
    navRef.current = {
      next: () => go(1),
      prev: () => go(-1),
      showByIndex: (i) => showIndex(i),
    };
    return () => {
      if (navRef) navRef.current = null;
    };
  }, [navRef, go, showIndex]);

  useFrame((state, dt) => {
    if (!readyRef.current) return;

    const t = state.clock.getElapsedTime() * 0.8;
    const offX = Math.cos(t * 0.9) * 0.12;
    const offY = Math.sin(t) * 0.18;
    const rotZOff = Math.cos(t * 0.7) * 0.02;
    const s = 1 + Math.sin(t * 0.5) * 0.008;

    const a = anchor.current;
    if (a) {
      const K = 6;
      const zoom = zoomRef?.current ?? 1;
      a.position.x = THREE.MathUtils.lerp(a.position.x, offX, 1 - Math.exp(-K * dt));
      a.position.y = THREE.MathUtils.lerp(a.position.y, offY, 1 - Math.exp(-K * dt));
      a.rotation.x = THREE.MathUtils.lerp(a.rotation.x, -0.09, 1 - Math.exp(-K * dt));
      a.rotation.z = THREE.MathUtils.lerp(a.rotation.z, 0.04 + rotZOff, 1 - Math.exp(-K * dt));
      a.scale.x = THREE.MathUtils.lerp(a.scale.x, BASE_SCALE * s * zoom, 1 - Math.exp(-K * dt));
      a.scale.y = THREE.MathUtils.lerp(a.scale.y, BASE_SCALE * s * zoom, 1 - Math.exp(-K * dt));
      a.scale.z = 1;
    }

    const inMesh = (currentIsA.current ? meshB : meshA).current;
    const outMesh = (currentIsA.current ? meshA : meshB).current;
    const inMats = (currentIsA.current ? matsB : matsA).current;
    const outMats = (currentIsA.current ? matsA : matsB).current;

    if (anim.current.playing && inMesh && outMesh && inMats && outMats) {
      anim.current.t += dt / anim.current.dur;
      const p = ease(anim.current.t);
      const dir = anim.current.dir;

      outMesh.position.x = THREE.MathUtils.lerp(0, -dir * SLIDE_X, p);
      inMesh.position.x = THREE.MathUtils.lerp(dir * SLIDE_X, 0, p);

      setOpacity(outMats, 1 - p);
      setOpacity(inMats, p);

      if (anim.current.t >= 1) {
        anim.current.playing = false;
        anim.current.t = 0;
        currentIsA.current = !currentIsA.current;

        // NEW: use explicit target index if provided
        indexRef.current =
          anim.current.setIndex != null
            ? anim.current.setIndex
            : (indexRef.current + dir + urls.length) % urls.length;

        const hiddenMesh = (currentIsA.current ? meshB : meshA).current;
        const hiddenMats = (currentIsA.current ? matsB : matsA).current;
        if (hiddenMesh) hiddenMesh.position.x = SLIDE_X;
        setOpacity(hiddenMats, 0);
      }
    }
  });

  return (
    <group ref={anchor}>
      <mesh ref={meshA} position={[0, -2, 0]}>
        <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
        <group position={[0, 0, CARD_D / 2 + 0.2]}>
          <pointLight intensity={1.1} distance={50} decay={1.2} />
        </group>
      </mesh>

      <mesh ref={meshB} position={[SLIDE_X, -2, 0]}>
        <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
      </mesh>

      <Html>
        <div className="pointer-events-none fixed inset-0">
          <button
            type="button"
            aria-label="Previous card"
            onClick={() => navRef?.current?.prev?.()}
            className="pointer-events-auto absolute left-[20vw] top-1/2 -translate-y-1/2 p-2 active:scale-95 transition">
            <svg
              width="72"
              height="72"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white hover:text-yellow-300 transition-colors">
              <path
                d="M9 6L15 12L9 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Next card"
            onClick={() => navRef?.current?.next?.()}
            className="pointer-events-auto absolute right-[20vw] top-1/2 -translate-y-1/2 p-2 active:scale-95 transition">
            <svg
              width="72"
              height="72"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white hover:text-yellow-300 transition-colors">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </Html>
    </group>
  );
}
