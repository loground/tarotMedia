import React, { useState } from 'react';
import { useGLTF, useCursor } from '@react-three/drei';
import { ChartInScene } from './Chart';
import { TowelieAnim } from './Towelie';
export function TokenBackground({ uProgression = 0, ...props }) {
  const { nodes, materials } = useGLTF('/models/mr_garrison4-opt.glb');
  const [hovered, setHovered] = useState(false);
  useCursor(hovered); // 👈 sets cursor: pointer when hovered

  return (
    <group {...props} dispose={null} scale={35} position-y={-200}>
      <TowelieAnim />

      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cube002.geometry}
        material={materials.skin}
        position={[-6.421, 5.098, 0.777]}
        rotation={[0.247, 0.191, 0.281]}
        scale={0.299}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cube003.geometry}
        material={materials.purple}
        position={[-6.421, 5.098, 0.777]}
        rotation={[0.247, 0.191, 0.281]}
        scale={0.707}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Sphere.geometry}
        material={materials.eye}
        position={[-6.421, 5.098, 0.777]}
        rotation={[0.247, 0.191, 0.281]}
        scale={0.731}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Icosphere.geometry}
        material={materials.eye1}
        position={[-6.407, 5.08, 0.846]}
        rotation={[0.247, 0.191, 0.281]}
        scale={0.033}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane.geometry}
        material={materials.beard}
        position={[-6.421, 5.098, 0.777]}
        rotation={[0.247, 0.191, 0.281]}
        scale={0.707}
      />

      <group position={[-6.421, 5.098, 0.777]} rotation={[0.247, 0.191, 0.281]} scale={0.656}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube007_1.geometry}
          material={materials.hat1}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube007_2.geometry}
          material={materials.hat2}
        />
      </group>

      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cube009.geometry}
        material={materials.eye1}
        position={[-6.421, 5.098, 0.777]}
        rotation={[0.247, 0.191, 0.281]}
        scale={0.707}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cube010.geometry}
        material={materials['skin.001']}
        position={[-4.972, 6.091, 0.145]}
        scale={0.392}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane002.geometry}
        material={materials.hair}
        position={[-4.977, 6.243, -0.911]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane008.geometry}
        material={materials.green1}
        position={[-4.971, 4.055, -0.084]}
        scale={[0.683, 0.653, 0.683]}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane011.geometry}
        material={materials.green2}
        position={[-4.977, 2.776, -0.183]}
        scale={[1.059, 1.068, 1.068]}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane012.geometry}
        material={materials.shoes}
        position={[-4.546, 0.531, -0.334]}
        scale={0.836}
      />

      <group position={[-0.033, 0.413, -0.075]} scale={3.594}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Plane005.geometry}
          material={materials.class1}
        />
        <mesh
          scale={3}
          castShadow
          receiveShadow
          geometry={nodes.Plane005_1.geometry}
          material={materials.class2}
        />
      </group>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane022.geometry}
        material={materials['class1.001']}
        position={[-0.033, 4.275, -3.669]}
        scale={3.594}
      />
      <group position={[-1.3, 5.275, -3.669]} scale={1.5}>
        <ChartInScene uProgression={uProgression} />
      </group>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane023.geometry}
        material={materials.class3}
        position={[3.023, 1.076, 0.411]}
      />
      <mesh
        className="hover:cursor-pointer"
        castShadow
        receiveShadow
        geometry={nodes.Plane024.geometry}
        material={materials.class5}
        position={[0.037, 8.484, -3.669]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={() => {
          window.open(
            'https://dexscreener.com/base/0x5a8e535a71cf042790c4ffefa502d554908ff72a',
            '_blank', // opens in new tab; use "_self" to redirect in same tab
          );
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.mnkey.geometry}
        material={materials.mnkey}
        position={[4.323, 6.456, -3.638]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane025.geometry}
        material={materials.blue}
        position={[3.44, 7.202, -3.669]}
        rotation={[0, 0, -0.668]}
        scale={1.013}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Иллюстрация_без_названия_4.geometry}
        material={materials['Иллюстрация_без_названия 4']}
        position={[3.035, 3.199, 0.391]}
        rotation={[0, -0.336, 0]}
        scale={1.755}
      />
    </group>
  );
}

useGLTF.preload('/models/mr_garrison4-opt.glb');
