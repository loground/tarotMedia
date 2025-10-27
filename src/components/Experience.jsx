// Experience.jsx
import { Environment, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useRef, useState, useCallback } from 'react';

import { CardsMobile } from './Cardsmobile';
import WebcamSky from './WebcamBg';
import HandRotateController from './GandsRotateController';
import useWebcam from '../components/hooks/useWebcam';
import SpeechController from '../components/SpeechController';

const MOBILE_BP = 768;
function useIsMobile() {
  const { size } = useThree();
  return size.width <= MOBILE_BP;
}

// 22 fortune buckets (use your full list)
const FORTUNES = [
  [
    'Base gas stays cheap — deployers prosper.',
    'Next pump looks like a bug, then a feature.',
    'Degen entry now, cope later.',
  ],
  ['Your bags become memes; your memes become culture.', 'NFA, but LFG soon™.', 'WGMI vibes.'],
  ['Anons bless your entries; exit liquidity arrives late.', 'Green candles attract haters.'],
  ['PEPE flips your boredom.', 'Frogs croak: “check Dexscreener.”', 'Ribbit = limit.'],
  ['Hold the line.', 'The top wasn’t top — just the pre-top.', 'Diamond hands prevail.'],
  ['STONKS ↗ after max pain.', 'Macro shrugs; your micro pumps.'],
  ['Bank runs? Not your chain.', 'APY appears when you stop looking.', 'Bot snipes your snipe.'],
  ['Jungle beats bear — again.', 'Primates trade better at night.', 'Banana RSI overbought.'],
  ['DRB curls like a smile.', 'Hidden bid walls protect your heart.'],
  ['Corn forks; your seed phrase doesn’t.', 'Vibes > whitepaper this week.'],
  ['Dickbutt marks the pico-bottom.', 'If it feels dumb, re-check liquidity.'],
  ['Mfers mf — then moon.', 'Low cap, high cope, rare win incoming.'],
  ['Base turns bullish.', 'Bridge once, flex twice.'],
  ['Film a tree; chart turns green.', 'Narratives rotate — stay nimble.'],
  ['Ink dries on your 10x.', 'Contract reads you back: “gm.”'],
  ['Melted charts reforge stronger.', 'Heat maps hide your alpha.'],
  ['Seacasa season approaches.', 'Liquidity naps, then sprints.'],
  ['Filthy gains need clean risk.', 'Charts align with your playlist.'],
  ['Johnny cashes; shorts dash.', 'Music to your PnL.'],
  ['Sarto stitches perfect entries.', 'Thread by thread, stack by stack.'],
  ['Souljak vibes protect entries.', 'Onchain whispers your name.'],
  ['God-tier patience → god-tier exit.', 'Devil candles test your faith.'],
];

function pickFortunes(list, n = 3) {
  if (!list?.length) return [];
  const pool = [...list];
  const out = [];
  while (out.length < Math.min(n, pool.length)) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function waitForNav(navRef, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const id = setInterval(() => {
      if (navRef.current?.spinAndStopRandom) {
        clearInterval(id);
        resolve(true);
      } else if (performance.now() - t0 > timeoutMs) {
        clearInterval(id);
        resolve(false);
      }
    }, 16);
  });
}

export const Experience = (props) => {
  useIsMobile();

  const cardsAnchorRef = useRef();
  const zoomRef = useRef(1);
  const navRef = useRef();

  const video = useWebcam();

  const [showDeck, setShowDeck] = useState(false); // mount CardsMobile/Hands
  const [deckVisible, setDeckVisible] = useState(false); // actually visible (for first spin)
  const [fortune, setFortune] = useState(null); // { index, lines }

  // Show deck, wait for nav, paint one frame, spin to random, show fortune
  const revealFuture = useCallback(async () => {
    if (!showDeck) setShowDeck(true);

    await waitForNav(navRef);

    setDeckVisible(true);
    await new Promise(requestAnimationFrame); // let it render once before the spin

    const finalIndex =
      (await navRef.current?.spinAndStopRandom?.({ spins: 10, finalDelay: 0.28 })) ?? 0;

    const lines = pickFortunes(FORTUNES[finalIndex], 3);
    setFortune({ index: finalIndex, lines });
  }, [showDeck]);

  // Hide fortune when leaving that card
  const handleIndexChange = useCallback(
    (idx) => {
      if (fortune && idx !== fortune.index) setFortune(null);
    },
    [fortune],
  );

  return (
    <group {...props}>
      <Environment preset="sunset" />
      <pointLight position={[12, 5, 12]} intensity={1.2} decay={0.8} distance={100} color="white" />
      <directionalLight position={[-15, 5, -15]} intensity={1.2} color="skyblue" />

      {video && <WebcamSky video={video} />}

      {showDeck && (
        <>
          <CardsMobile
            anchorRef={cardsAnchorRef}
            zoomRef={zoomRef}
            navRef={navRef}
            onIndexChange={handleIndexChange}
            visible={deckVisible}
          />

          {/* Hands own rotation completely */}
          {video && (
            <HandRotateController
              video={video}
              anchorRef={cardsAnchorRef}
              zoomRef={zoomRef}
              navRef={navRef}
            />
          )}
        </>
      )}

      {/* Voice: “what’s my future” calls the exact same path */}
      <SpeechController
        navRef={navRef}
        lang="en-US"
        onAskFuture={revealFuture}
        showDeck={showDeck}
      />

      {/* Initial CTA */}
      {!showDeck && (
        <Html fullscreen>
          <div className="fixed top-60 inset-0 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={revealFuture}
              className="pointer-events-auto font-de px-6 py-3 rounded-2xl bg-black/85 hover:bg-black font-bold text-white uppercase tracking-widest shadow-xl active:scale-95 transition"
              aria-label="My Future">
              My Future
            </button>
          </div>
        </Html>
      )}

      {/* Fortune panel */}
      {fortune && showDeck && (
        <Html fullscreen>
          <div className="absolute top-10 right-20 z-[9] pointer-events-none">
            <div className="pointer-events-auto max-w-[92vw] md:max-w-[420px] bg-black/75 text-white rounded-2xl backdrop-blur px-5 py-4 shadow-2xl ring-1 ring-white/10">
              <div className="text-xs opacity-70 uppercase tracking-wide">Fortune prediction</div>
              <ul className="mt-1 space-y-1 text-sm leading-snug">
                {fortune.lines.map((l, i) => (
                  <li key={i}>• {l}</li>
                ))}
              </ul>
              <div className="mt-2 text-[11px] opacity-60">Switch cards to hide this fortune.</div>
            </div>
          </div>
        </Html>
      )}

      <Background />
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
