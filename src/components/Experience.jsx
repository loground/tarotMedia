// Experience.jsx
import {
  Environment,
  useTexture,
  OrbitControls,
  Html,
  Hud,
  OrthographicCamera,
  shaderMaterial,
} from '@react-three/drei';
import * as THREE from 'three';
import { MeshDepthMaterial } from 'three';
import { degToRad, MathUtils } from 'three/src/math/MathUtils.js';
import { extend, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState, useRef } from 'react';

import { CardsMobile } from './Cardsmobile';
import WebcamSky from './WebcamBg';
import HandRotateController from './GandsRotateController';
import useWebcam from '../components/hooks/useWebcam';
import SpeechController from '../components/SpeechController';

const depthMaterial = new MeshDepthMaterial();
depthMaterial.depthPacking = THREE.RGBADepthPacking;
depthMaterial.blending = THREE.NoBlending;

const MOBILE_BP = 768;

function useIsMobile() {
  const { size } = useThree();
  return size.width <= MOBILE_BP;
}

// Per-mode camera/controls presets (tweak as you like)

export const Experience = ({ ...props }) => {
  const isMobile = useIsMobile();
  const { camera } = useThree();
  const cardsAnchorRef = useRef(); // <— external anchor to rotate
  const video = useWebcam();
  const zoomRef = useRef(1); // ← shared zoom factor
  const navRef = useRef();

  return (
    <group {...props}>
      {/* Controls no longer remount — limits updated dynamically */}

      {/* LIGHTS */}
      <Environment preset="sunset" />
      <pointLight position={[12, 5, 12]} intensity={1.2} decay={0.8} distance={100} color="white" />
      <directionalLight position={[-15, 5, -15]} intensity={1.2} color="skyblue" />

      {video && <WebcamSky video={video} />}

      {/* SCENES — instant switch during hold, covered by transition */}

      <CardsMobile anchorRef={cardsAnchorRef} zoomRef={zoomRef} navRef={navRef} />
      {video && <HandRotateController video={video} anchorRef={cardsAnchorRef} zoomRef={zoomRef} />}

      <SpeechController navRef={navRef} lang="en-EN" />

      {/* Global background stays */}
      <Background />

      {/* Transition overlay */}

      {/* Switcher UI — centered, 20% from bottom */}
    </group>
  );
};

export const Background = () => {
  const map = useTexture('/bggg2.jpg');
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.x = -1;
  map.offset.x = 1;
  map.needsUpdate = true;

  return (
    <mesh scale={1.3} position-z={-180} rotation-y={Math.PI / 1.5}>
      <sphereGeometry args={[360, 80, 80]} />
      <meshBasicMaterial side={THREE.BackSide} map={map} toneMapped={false} />
    </mesh>
  );
};
