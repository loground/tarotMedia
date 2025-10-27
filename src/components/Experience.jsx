// Experience.jsx
import { Environment, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useRef, useState, useCallback, useEffect } from 'react';

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

// Predictions per card — any length per bucket is fine.
const FORTUNES = [
  // 0
  [
    'Gotta get rich with bankr',
    'x402 gotta pump your bags',
    'Pick up one ok, computer, this is what you need at the moment',
  ],
  // 1
  [
    'About to make your first million on vibe market',
    'dm nico and ask how to become a vibellionaire',
    'open a few packs, it is your day today',
  ],
  // 2
  [
    'Better go code something today',
    'Go crazy about stuff you create, when creating something, or stop creating',
    'Have some rest, there should be those days',
  ],
  // 3
  [
    'Check your portfolio, you might made some money',
    'Go touch some grass”',
    'Have a deeper look at base memes that pumping',
  ],
  // 4
  [
    'Watch what jesse buys, it might be your next win',
    'Reply to next jesses post, its something you need',
    'Base is a good place to start if you havent yet',
  ],
  // 5
  [
    'Will catch a good moment to take profits',
    'About to have some good trading decisions',
    'Even if you do nothing, it might pump anyways, just catch the right moment',
  ],
  // 6
  [
    'Claim your rewards, always check what you have',
    'make it to top-100 leaderboard of bankr, its gonna worth it ',
    '$bankr is where you gonna make some real profits this year',
  ],
  // 7
  [
    'It is always good time to get a new ape',
    'Apes better trading at night',
    'Sell some bananas, buy some $JBM',
  ],
  // 8
  [
    'Just smile, it is your day',
    'might get rich as grok, who knows?',
    'if token went down today - better pick some up, DRB time is coming',
  ],
  // 9
  [
    'Send some memes to birt, make his day',
    'Tell yourself you love YOU',
    'next 1000 packs will bring you hella money',
  ],
  // 10
  ['Buy some dickbutt', '1 dick = 1 butt', 'Green liquidity flows into your dick or butt '],
  // 11
  ['Do what you want', 'Maybe it is time to buy another mfer?', '$mfer token is the answer'],
  // 12
  [
    'Post on base app, it might fly',
    'Use more base, airdrop will be huge',
    'follow loground on base app',
  ],
  // 13
  ['I have no clue what to write here', 'Probably time to plant a tree or film something i dunno'],
  // 14
  [
    'Be careful, your face might be redrawn into ass bu this guy',
    'Bought $meme-park? Better buy some more',
    'You never gonna draw 100 arts as fast as this guy, sorry',
  ],
  // 15
  [
    'Whoops, the chart of your token just got destroyed',
    'Listen to next KOL call, it is lifechanging (joking)',
  ],
  // 16
  [
    'Brick by brick, you gonna make it',
    'You about to win next subscribers giveaway',
    'Just hold to whatever you got, you gonna make it',
  ],
  // 17
  [
    'Send filthy a pic of your feet dm and see where it gets you',
    'You gotta turn green (like your skin and you wallet)',
    'Grow your hair, why dont you?',
  ],
  // 18
  ['You need a new crocs', 'Order some new jibbits'],
  // 19
  [
    'Study something new, you never know where it takes you',
    'You need more ok, computers',
    'Color your hair to purple, it will change everything',
  ],
  // 20
  ['Say something good to your haters, they are not ready for it', 'Rip one souljak, it is time'],
  // 21
  [
    'Something or someone gotta take you to next level, just stay patient',
    'Share what you think with everyone, you might be the one who change the game',
    'Lmao wtf should I write here',
  ],
  [
    'You the GOAT and you should know that',
    'Build something and tag Jesse',
    'Vibe market might change everything for you',
  ],
];

/** Non-repeating picker per card.
 * Shows every prediction once in random order, then reshuffles and repeats.
 */
function createNonRepeatingPicker() {
  // Map<cardIndex, { order:number[]; ptr:number }>
  const state = new Map();

  function ensure(cardIdx) {
    if (!state.has(cardIdx)) {
      const n = Array.isArray(FORTUNES[cardIdx]) ? FORTUNES[cardIdx].length : 0;
      const order = [...Array(n).keys()];
      // shuffle
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      state.set(cardIdx, { order, ptr: 0 });
    }
    return state.get(cardIdx);
  }

  return function pick(cardIdx) {
    const list = FORTUNES[cardIdx] || [];
    if (list.length === 0) return null;

    const s = ensure(cardIdx);
    if (s.ptr >= s.order.length) {
      // reshuffle for a fresh cycle
      const n = list.length;
      s.order = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s.order[i], s.order[j]] = [s.order[j], s.order[i]];
      }
      s.ptr = 0;
    }

    const idxInList = s.order[s.ptr++];
    return list[idxInList] ?? null;
  };
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

  const [showDeck, setShowDeck] = useState(false);
  const [deckVisible, setDeckVisible] = useState(false);
  // fortune now holds ONE line
  const [fortune, setFortune] = useState(null); // { index: number, line: string }

  // create one picker instance for the session
  const pickerRef = useRef(null);
  if (!pickerRef.current) pickerRef.current = createNonRepeatingPicker();
  const pickOne = pickerRef.current;

  // Show deck, spin, and show a single non-repeating prediction
  const revealFuture = useCallback(async () => {
    if (!showDeck) setShowDeck(true);

    await waitForNav(navRef);

    setDeckVisible(true);
    await new Promise(requestAnimationFrame);

    const finalIndex =
      (await navRef.current?.spinAndStopRandom?.({ spins: 10, finalDelay: 0.28 })) ?? 0;

    const line = pickOne(finalIndex);
    setFortune(line ? { index: finalIndex, line } : null);
  }, [showDeck, pickOne]);

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

      {/* Voice: “what’s my future” -> same path */}
      <SpeechController
        navRef={navRef}
        lang="en-US"
        onAskFuture={revealFuture}
        showDeck={showDeck}
      />

      {/* Initial CTA */}
      {!showDeck && (
        <Html>
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
        <Html>
          <div className="fixed  right-40 z-[10] pointer-events-none">
            <div className="pointer-events-auto max-w-[92vw] md:max-w-[420px] bg-black/75 text-white rounded-2xl backdrop-blur px-5 py-4 shadow-2xl ring-1 ring-white/10">
              <div className="text-xl font-de opacity-70 uppercase tracking-wide">Your future:</div>
              <ul className="mt-1 space-y-1 text-sm leading-snug">
                <li>• {fortune.line}</li>
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
