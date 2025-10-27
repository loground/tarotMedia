// components/SpeechController.jsx
import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';

/** ---------------- Voice patterns ---------------- */
const NEXT_PATTERNS = [/\bnext\b/i, /\bforward\b/i, /след(ующая|ующий)/i, /далее/i];
const BACK_PATTERNS = [/\bback\b/i, /\bprevious\b/i, /назад/i, /предыдущ(ая|ий)/i];
const FUTURE_PATTERNS = [
  /\bwhat'?s\s+my\s+future\b/i,
  /\bmy\s+future\b/i,
  /каков[а-я\s]*\s+моя\s+судьба/i,
  /что\s+(со|c)\s+мо(ей|ей)\s+судьб[оа]й/i,
];
const OPEN_LINK_PATTERNS = [
  /\bopen\s+(the\s+)?link\b/i,
  /\bopen\s+link\b/i,
  /откр(ой|ыть)\s*ссылк[уае]?/i,
  /\bссылк[ауе]?\s*откр(ой|ыть)?\b/i,
];

/** ---------------- Card names (22) ----------------
 * Keep order in sync with your deck.
 */
const CARD_TITLES = [
  'deployer',
  'nico',
  'jc',
  'pepe',
  'jesse',
  'stonks',
  'bankr',
  'jungle bay',
  'drb',
  'birtcorn',
  'dickbutt',
  'mfer',
  'base',
  'filmatree',
  'ink',
  'melted',
  'seacasa',
  'filthy',
  'johnny cash',
  'sarto',
  'souljak',
  'god',
  'final',
];

// Per-card destination links (edit as you wish)
const DEFAULT_LINK = 'https://x.com';
const CARD_LINKS = [
  'https://x.com/0xDeployer',
  'https://vibechain.com/market',
  'https://www.youtube.com/watch?v=pKN9trFSACI',
  'https://vibechain.com/market/tarot',
  'https://jesse.xyz',
  'https://x.com/Stonks_OG',
  'https://bankr.bot',
  'https://junglebayisland.com',
  'https://opensea.io/token/base/0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2',
  'https://farcaster.xyz/birtcorn',
  'https://x.com/DickbuttCTO',
  'https://opensea.io/collection/mfers',
  'https://farcaster.xyz/baseapp.base.eth',
  'https://farcaster.xyz/filmatree',
  'https://www.inkmfer.com',
  'https://linktr.ee/meltedmindz',
  'https://x.com/_seacasa',
  'https://www.filthytrikks.com',
  'https://x.com/JohnnyCash4243/status/1980274566472814726',
  'https://vibechain.com/market/historyofcomputer?ref=0HTIY11FVZDZ',
  'https://www.souljak.wtf/',
  'https://x.com/cryptojcdenton/status/1976835381904781649',
  'https://x.com/jessepollak/status/1981752869146816767',
];

// Strong patterns + alias fallbacks for noisy ASR
const CARD_PATTERNS = [
  { re: /\bjohnny\s+cash\b/i, idx: 18 },
  { re: /\bjungle\s*bay\b/i, idx: 7 },
  { re: /\bdeployer\b/i, idx: 0 },
  { re: /\bnico\b/i, idx: 1 },
  { re: /\bjc\b/i, idx: 2 },
  { re: /\bpepe\b/i, idx: 3 },
  { re: /\bjesse\b/i, idx: 4 },
  { re: /\bstonks\b/i, idx: 5 },
  { re: /\bbankr\b/i, idx: 6 },
  { re: /\bdrb\b/i, idx: 8 },
  { re: /\bbirtcorn\b/i, idx: 9 },
  { re: /\bdickbutt\b/i, idx: 10 },
  { re: /\bmfer\b/i, idx: 11 },
  { re: /\bbase\b/i, idx: 12 },
  { re: /\bfilmatree\b/i, idx: 13 },
  { re: /\bink\b/i, idx: 14 },
  { re: /\bmelted\b/i, idx: 15 },
  { re: /\bseacasa\b/i, idx: 16 },
  { re: /\bfilthy\b/i, idx: 17 },
  { re: /\bsarto\b/i, idx: 19 },
  { re: /\bsouljak\b/i, idx: 20 },
  { re: /\bgod\b/i, idx: 21 },
  { re: /\bfinal\b/i, idx: 22 },
];

const CARD_ALIASES = {
  16: [
    /\bsea\s*casa\b/i,
    /\bsee\s*casa\b/i,
    /\bsi\s*casa\b/i,
    /\bsu\s*casa\b/i,
    /\bse[ae]\s*cassa\b/i,
  ],
  18: [/\bjohnny\s*kash\b/i, /\bjohnny\s*cache\b/i, /\bjoh?n?y\s*cash\b/i],
  7: [/\bjungle\s*bae?\b/i, /\bjangle\s*bay\b/i, /\bjungle\s*day\b/i],
  10: [/\bdic+k?b(u|a)t+\b/i, /\bdick\s*but+\b/i],
  11: [/\bem\s*fair\b/i, /\bem\s*fer\b/i, /\bma?fer\b/i],
  5: [/\bstocks?\b/i, /\bstonx\b/i],
};

/** ---------------- Fuzzy helpers ---------------- */
const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function lev(a, b) {
  a = norm(a);
  b = norm(b);
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

function tryCardIndexFromUtterance(utterance) {
  const text = utterance.toLowerCase();

  // 1) direct patterns
  for (const { re, idx } of CARD_PATTERNS) {
    if (re.test(text)) return idx;
  }
  for (const [idxStr, list] of Object.entries(CARD_ALIASES)) {
    const idx = Number(idxStr);
    for (const re of list) if (re.test(text)) return idx;
  }

  // 2) fuzzy
  const u = norm(utterance);
  let bestIdx = null,
    best = Infinity;
  for (let i = 0; i < CARD_TITLES.length; i++) {
    const t = norm(CARD_TITLES[i]);
    const d = Math.min(lev(u, t), lev(u.replace(/\s+/g, ''), t.replace(/\s+/g, '')));
    if (d < best) {
      best = d;
      bestIdx = i;
    }
    if (d <= 1) return i;
  }
  const tBest = norm(CARD_TITLES[bestIdx ?? 0] || '');
  const tol = Math.min(3, Math.max(1, Math.floor(Math.max(tBest.length, 3) * 0.3)));
  return best <= tol ? bestIdx : null;
}

/** ---------------- Component ---------------- */
export default function SpeechController({ navRef, lang = 'en-US', onAskFuture, showDeck }) {
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [showNames, setShowNames] = useState(false);

  const recogRef = useRef(null);
  const keepAlive = useRef(true);
  const lastTriggerAt = useRef(0);
  const lastResultAt = useRef(performance.now());
  const watchdogRef = useRef(0);

  // best-effort: what's currently shown (if navRef doesn't expose a getter)
  const lastShownIdx = useRef(null);

  const triggerOnce = (cb) => {
    const now = performance.now();
    if (now - lastTriggerAt.current < 450) return false;
    lastTriggerAt.current = now;
    cb?.();
    return true;
  };

  const getActiveIndex = () => {
    const nav = navRef?.current;
    if (!nav) return lastShownIdx.current;
    if (typeof nav.getActiveIndex === 'function') return nav.getActiveIndex();
    if (typeof nav.getIndex === 'function') return nav.getIndex();
    if (typeof nav.activeIndex === 'number') return nav.activeIndex;
    return lastShownIdx.current;
  };

  const openCardLink = (idx) => {
    if (!Number.isInteger(idx) || idx < 0 || idx >= CARD_LINKS.length) return;
    const url = CARD_LINKS[idx] || DEFAULT_LINK;
    try {
      window.open(url, '_blank');
    } catch {
      window.location.href = url;
    }
  };

  function checkCommands(textRaw) {
    lastResultAt.current = performance.now();
    const text = textRaw.toLowerCase();

    // 0) future sequence
    if (FUTURE_PATTERNS.some((p) => p.test(text))) {
      triggerOnce(() => onAskFuture?.());
      return;
    }

    // 1) open link (optionally with card name)
    if (OPEN_LINK_PATTERNS.some((p) => p.test(text))) {
      let idx = tryCardIndexFromUtterance(text);
      if (!Number.isInteger(idx)) idx = getActiveIndex();
      if (Number.isInteger(idx)) triggerOnce(() => openCardLink(idx));
      return;
    }

    // 2) card names (aliases/fuzzy)
    const cardIdx = tryCardIndexFromUtterance(text);
    if (Number.isInteger(cardIdx)) {
      triggerOnce(() => {
        navRef?.current?.showByIndex?.(cardIdx);
        lastShownIdx.current = cardIdx;
      });
      return;
    }

    // 3) next/back
    if (NEXT_PATTERNS.some((p) => p.test(text))) {
      triggerOnce(() => {
        navRef?.current?.next?.();
        requestAnimationFrame(() => {
          const now = getActiveIndex();
          if (Number.isInteger(now)) lastShownIdx.current = now;
        });
      });
      return;
    }
    if (BACK_PATTERNS.some((p) => p.test(text))) {
      triggerOnce(() => {
        navRef?.current?.prev?.();
        requestAnimationFrame(() => {
          const now = getActiveIndex();
          if (Number.isInteger(now)) lastShownIdx.current = now;
        });
      });
      return;
    }
  }

  /** ----- SpeechRecognition lifecycle (robust keepalive) ----- */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    recogRef.current = rec;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (res.isFinal) {
          setFinalText(text);
          setInterimText('');
          checkCommands(text);
        } else {
          interim += text + ' ';
        }
      }
      if (interim) {
        setInterimText(interim.trim());
        lastResultAt.current = performance.now();
      }
    };

    rec.onerror = () => {
      try {
        rec.stop();
      } catch {}
      setTimeout(() => {
        if (keepAlive.current) {
          try {
            rec.start();
          } catch {}
        }
      }, 300);
    };

    rec.onend = () => {
      if (keepAlive.current) {
        try {
          rec.start();
        } catch {}
      }
    };

    try {
      rec.start();
    } catch {}

    // watchdog: restart if idle for a while
    watchdogRef.current = window.setInterval(() => {
      const idleMs = performance.now() - lastResultAt.current;
      if (idleMs > 7000 && keepAlive.current) {
        try {
          rec.stop();
        } catch {}
        setTimeout(() => {
          try {
            rec.start();
          } catch {}
        }, 200);
      }
    }, 2000);

    return () => {
      keepAlive.current = false;
      window.clearInterval(watchdogRef.current);
      try {
        rec.stop();
      } catch {}
    };
  }, [lang]);

  /** ---------------- UI ---------------- */
  return (
    <Html>
      {/* Panel (bottom-right): voice commands + names dropdown */}
      <div className="fixed bottom-28 right-80 z-[9999] pointer-events-auto">
        <div className="w-[280px] rounded-2xl bg-black/70 backdrop-blur shadow-lg ring-1 ring-white/10 text-white">
          <div className="px-4 pt-3 pb-2">
            <div className="text-[20px] uppercase tracking-wide font-de">Voice</div>

            <div className="mt-2 space-y-2 text-sm">
              <div className="leading-snug">
                <span className="opacity-80">Find your future (once) by saying</span>{' '}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">
                  what’s my future
                </kbd>
              </div>

              <div className="leading-snug">
                <span className="opacity-80">say</span>{' '}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">next</kbd>
                <span className="mx-1 opacity-60">/</span>
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">back</kbd>
                <span className="ml-2 opacity-80">to navigate</span>
              </div>

              <div className="leading-snug">
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">open link</kbd>
                <span className="ml-2 opacity-80">to open card's website </span>
              </div>

              {showDeck && (
                <div className="leading-snug">
                  <span className="opacity-80">Select or pronounce a card name from the list</span>{' '}
                  <button
                    type="button"
                    className="align-middle rounded-md px-2 py-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 active:bg-white/25 transition"
                    onClick={() => setShowNames((s) => !s)}>
                    Names
                    <span
                      className="ml-1 inline-block"
                      style={{ transform: showNames ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▾
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {showNames && (
            <div className="px-3 pb-3">
              <div className="max-h-44 overflow-auto rounded-xl bg-white/5 p-2 grid grid-cols-2 gap-1.5 z-[10000]">
                {CARD_TITLES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    className="truncate text-left text-[12px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 transition"
                    onClick={() => {
                      try {
                        navRef?.current?.showByIndex?.(i);
                      } catch {}
                      lastShownIdx.current = i;
                      setShowNames(false);
                    }}
                    title={name}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transcript bubble (stays active under overlays) */}
      <div className="pointer-events-none fixed bottom-44 inset-x-0 flex justify-center z-[9999999]">
        <div className="min-w-[42vw] md:min-w-[22vw] md:max-w-[22vw] font-bold rounded-2xl bg-black/70 backdrop-blur px-4 py-3 text-white text-sm shadow-lg">
          {showDeck === true ? (
            <div>{finalText || 'Say the name of the card, open link, or next/back'}</div>
          ) : (
            <div>{finalText || 'Say “what’s my future" or click the button'}</div>
          )}

          {interimText && <div className="mt-1 text-xs opacity-70">{interimText}</div>}
        </div>
      </div>
    </Html>
  );
}
