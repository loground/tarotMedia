// App.tsx / App.jsx
import { Canvas } from '@react-three/fiber';
import { Experience } from './components/Experience';
import { Preload, useProgress } from '@react-three/drei';
import { Suspense } from 'react';

import './index.css';

import LoaderOverlay from './components/Loader';

function App() {
  // active === true while assets are loading (incl. <Preload all />)
  const { active } = useProgress();
  const isLoading = active; // or use: const isLoading = active || progress < 100;

  return (
    <>
      <Canvas dpr={[1, 1.5]} camera={{ position: [8, 12, 385], fov: 80 }} gl={{ antialias: true }}>
        <color attach="background" args={['#141400']} />
        <Suspense fallback={<LoaderOverlay />}>
          <Experience />
          <Preload all />
        </Suspense>
      </Canvas>

      {/* Show the button only when loading is done */}
      {!isLoading && <></>}
    </>
  );
}

export default App;
