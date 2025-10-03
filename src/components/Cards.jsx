// Cards.tsx
import { useCursor, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { memo, useMemo, useRef, useState, useCallback } from 'react';

const CARD_W = 5;
const CARD_H = 7;
const CARD_D = 0.15;

export function Cards() {
  // 1) Build the URL list: /cards/common1.avif ... /cards/common50.avif
  const COUNT = 60; // set how many cards you want to show
  const urls = useMemo(
    () => Array.from({ length: COUNT }, (_, i) => `/webp/common${i + 1}.webp`),
    [COUNT],
  );

  // 2) Preload ALL textures at once
  const textures = useTexture(urls);
  // Normalize color space and (optionally) anisotropy
  const glMaxAniso = 8; // you can bump this if you want crisper oblique angles
  textures.forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = glMaxAniso;
  });

  const indices = useMemo(() => Array.from({ length: COUNT }, (_, i) => i), [COUNT]);

  // Your existing state/modes
  const [mainIndex, setMainIndex] = useState(0);
  const [mode, setMode] = useState('single');

  const singleTarget = useMemo(
    () => ({ pos: new THREE.Vector3(0, 0, 0), rotY: 0, scale: 25, opacity: 1 }),
    [],
  );

  const fanTargets = useMemo(() => {
    const cols = 10;
    const rows = Math.ceil(COUNT / cols);
    const spacing = 1.2;
    const baseScale = 5;

    const w = cols * CARD_W * spacing * baseScale;
    const h = rows * CARD_H * spacing * baseScale;
    const x0 = -w / 2 + (CARD_W * spacing * baseScale) / 2;
    const y0 = h / 2 - (CARD_H * spacing * baseScale) / 2;

    return Array.from({ length: COUNT }, (_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const jitterX = (Math.random() - 0.5) * 0.4;
      const jitterY = (Math.random() - 0.5) * 0.4;
      const jitterR = (Math.random() - 0.5) * 0.2;

      return {
        pos: new THREE.Vector3(
          x0 + c * CARD_W * spacing * baseScale + jitterX,
          y0 - r * CARD_H * spacing * baseScale + jitterY,
          -2 - Math.random() * 1.5,
        ),
        rotY: jitterR,
        scale: baseScale,
        opacity: 1,
      };
    });
  }, [COUNT]);

  const focusTargets = useMemo(() => {
    const outRadius = 40;
    return Array.from({ length: COUNT }, (_, i) => {
      const angle = (i / COUNT) * Math.PI * 2;
      return {
        pos: new THREE.Vector3(
          Math.cos(angle) * outRadius,
          Math.sin(angle) * outRadius,
          -10 - i * 0.05,
        ),
        rotY: (Math.random() - 0.5) * 0.8,
        scale: 2,
        opacity: 0,
      };
    });
  }, [COUNT]);

  const getTargetFor = (i) => {
    if (mode === 'single') {
      return i === mainIndex
        ? singleTarget
        : { pos: new THREE.Vector3(0, 0, -20), rotY: 0, scale: 2, opacity: 0 };
    }
    if (mode === 'fan') return fanTargets[i];
    return i === mainIndex ? singleTarget : focusTargets[i];
  };

  const handleClickCard = useCallback(
    (i) => {
      if (mode === 'single') {
        setMode('fan');
        return;
      }
      if (mode === 'fan') {
        setMainIndex(i);
        setMode('focus');
      }
    },
    [mode],
  );

  const [focusT, setFocusT] = useState(0);
  useFrame((_, dt) => {
    if (mode === 'focus') {
      const t = Math.min(focusT + dt, 0.9);
      setFocusT(t);
      if (t >= 0.9) {
        setMode('single');
        setFocusT(0);
      }
    }
  });

  return (
    <group>
      {indices.map((i) => (
        <Card
          key={i}
          // 3) Give each card its own texture by index
          texture={textures[i % textures.length]}
          target={getTargetFor(i)}
          onClick={() => handleClickCard(i)}
          elevate={mode !== 'fan' && i === mainIndex}
          interactive={mode !== 'focus'}
          floatActive={mode === 'single' && i === mainIndex}
        />
      ))}
    </group>
  );
}

// --- Card component (unchanged behavior; now receives a per-card texture) ---
const Card = memo(
  ({ texture, target, onClick, elevate = false, interactive = true, floatActive = false }) => {
    const meshRef = useRef(null);
    const matsRef = useRef([]);
    const [hovered, setHovered] = useState(false);
    useCursor(Boolean(onClick) && hovered && interactive);

    // --- materials (same as before) ---
    const [frontMat, backMat, edgeMat] = useMemo(() => {
      const fm = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.45,
        metalness: 0.08,
        side: THREE.FrontSide,
        transparent: true,
        opacity: 1,
      });

      const backTex = texture.clone();
      backTex.needsUpdate = true;
      backTex.wrapS = THREE.RepeatWrapping;
      backTex.repeat.x = -1;
      backTex.offset.x = 1;

      const bm = new THREE.MeshStandardMaterial({
        map: backTex,
        roughness: 0.45,
        metalness: 0.08,
        side: THREE.FrontSide,
        transparent: true,
        opacity: 1,
      });

      const em = new THREE.MeshStandardMaterial({
        color: '#2a2a2a',
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
      });

      return [fm, bm, em];
    }, [texture]);

    matsRef.current = [frontMat, backMat, edgeMat];

    // scratch vectors to avoid GC
    const desiredPos = useRef(new THREE.Vector3());
    const baseScale = useRef(new THREE.Vector3());
    const initialized = useRef(false);

    // Float tunables
    const AMP_Y = 0.25; // vertical bob
    const AMP_X = 0.25; // subtle lateral sway
    const ROT_Y = 0.1; // gentle yaw
    const ROT_Z = 0.02; // gentle roll
    const SCALE_BREATH = 0.1; // 1% scale breathing
    const SPD = 0.8; // speed multiplier

    useFrame((state, dt) => {
      const m = meshRef.current;
      if (!m) return;

      // Compute float offsets (don’t mutate target)
      const t = state.clock.getElapsedTime() * SPD;
      const offX = floatActive ? Math.cos(t * 0.9) * AMP_X : 0;
      const offY = floatActive ? Math.sin(t) * AMP_Y : 0;
      const rotYOff = floatActive ? Math.sin(t * 0.6) * ROT_Y : 0;
      const rotZOff = floatActive ? Math.cos(t * 0.7) * ROT_Z : 0;
      const scaleMul = floatActive ? 1 + Math.sin(t * 0.5) * SCALE_BREATH : 1;

      // Desired pos = target.pos + float offset
      desiredPos.current.copy(target.pos).addScalar(0); // reset
      desiredPos.current.x += offX;
      desiredPos.current.y += offY;
      desiredPos.current.z += 0; // keep depth stable

      // First frame snap
      if (!initialized.current) {
        m.position.copy(desiredPos.current);
        m.rotation.set(-0.07, target.rotY + rotYOff, 0.03 + rotZOff);
        m.scale.set(target.scale * scaleMul, target.scale * scaleMul, 1);
        matsRef.current.forEach((mat) => {
          mat.opacity = target.opacity;
          mat.depthWrite = target.opacity > 0.99;
        });
        initialized.current = true;
        return;
      }

      // Easing
      const k = 6;
      const kO = 4;

      // Position
      m.position.lerp(desiredPos.current, 1 - Math.exp(-k * dt));

      // Rotation (base tilt + float wobble)
      const baseTiltX = elevate ? -0.15 : -0.07;
      const baseTiltZ = elevate ? 0.08 : 0.03;
      m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, baseTiltX, 1 - Math.exp(-k * dt));
      m.rotation.y = THREE.MathUtils.lerp(
        m.rotation.y,
        target.rotY + rotYOff,
        1 - Math.exp(-k * dt),
      );
      m.rotation.z = THREE.MathUtils.lerp(m.rotation.z, baseTiltZ + rotZOff, 1 - Math.exp(-k * dt));

      // Scale (breathing)
      baseScale.current.set(target.scale * scaleMul, target.scale * scaleMul, 1);
      m.scale.lerp(baseScale.current, 1 - Math.exp(-k * dt));

      // Opacity
      const nextO = THREE.MathUtils.lerp(
        matsRef.current[0].opacity,
        target.opacity,
        1 - Math.exp(-kO * dt),
      );
      matsRef.current.forEach((mat) => {
        mat.opacity = nextO;
        mat.transparent = nextO < 1 || hovered;
        mat.depthWrite = nextO > 0.99;
      });

      // Disable raycast when invisible or during transitions
      m.raycast = nextO < 0.15 || !interactive ? () => {} : THREE.Mesh.prototype.raycast;
    });

    const materials = useMemo(
      () => [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat],
      [frontMat, backMat, edgeMat],
    );

    return (
      <mesh
        ref={meshRef}
        material={materials}
        onClick={interactive ? onClick : undefined}
        onPointerOver={() => interactive && setHovered(true)}
        onPointerOut={() => setHovered(false)}>
        <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
        {elevate && (
          <group position={[0, 0, CARD_D / 2 + 0.2]}>
            <pointLight intensity={1.2} distance={50} decay={1.2} />
          </group>
        )}
      </mesh>
    );
  },
);
