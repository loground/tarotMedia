// components/WebcamSky.jsx
import * as THREE from 'three';
import { useMemo, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

export default function WebcamSky({ video }) {
  const textureRef = useRef(null);
  const { gl } = useThree();

  const tex = useMemo(() => {
    if (!video) return null;
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    // front camera is mirrored — flip X so the sphere looks natural
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = -1;
    t.needsUpdate = true;
    textureRef.current = t;
    return t;
  }, [video]);

  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose?.();
      }
    };
  }, [gl]);

  if (!tex) return null;

  return (
    <mesh scale={1}>
      <sphereGeometry args={[320, 80, 80]} />
      <meshBasicMaterial side={THREE.BackSide} map={tex} toneMapped={false} />
    </mesh>
  );
}
