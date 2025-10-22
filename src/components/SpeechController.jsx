// components/SpeechController.jsx
import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';

// next/back
const NEXT_PATTERNS = [/\bnext\b/i, /\bforward\b/i, /след(ующая|ующий)/i, /далее/i];
const BACK_PATTERNS = [/\bback\b/i, /\bprevious\b/i, /назад/i, /предыдущ(ая|ий)/i];

// ✅ NEW: "open link" voice triggers (EN + RU)
const OPEN_LINK_PATTERNS = [
  /\bopen\s+(the\s+)?link\b/i,
  /\bopen\s+link\b/i,
  /откр(ой|ыть)\s*ссылк[уае]?/i, // "открой ссылку/открыть ссылку"
  /\bссылк[ауе]?\s*откр(ой|ыть)?\b/i,
];

// Canonical names by index — keep in sync with deck order
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
];

// Primary literal patterns (specific → general)
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
];

// Known ASR aliases/mis-hearings (extend freely)
const CARD_ALIASES = {
  16: [
    /\bsea\s*casa\b/i,
    /\bsee\s*casa\b/i,
    /\bsi\s*casa\b/i,
    /\bsu\s*casa\b/i,
    /\bse[ae]\s*cassa\b/i,
    /\bseacaza\b/i,
  ], // seacasa
  18: [/\bjohnny\s*kash\b/i, /\bjohnny\s*cache\b/i, /\bjoh?n?y\s*cash\b/i], // johnny cash
  7: [/\bjungle\s*bae?\b/i, /\bjangle\s*bay\b/i, /\bjungle\s*day\b/i], // jungle bay
  10: [/\bdick\s*but+\b/i, /\bdic+k?b(u|a)t+\b/i], // dickbutt
  11: [/\bem\s*fair\b/i, /\bem\s*fer\b/i, /\bma?fer\b/i], // mfer
  5: [/\bstocks?\b/i, /\bstonx\b/i], // stonks
};

// ---- helpers (same as before) ----
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

function fuzzyFindIndex(utterance) {
  const u = norm(utterance);
  if (!u) return null;
  let bestIdx = null,
    bestScore = Infinity;

  for (let idx = 0; idx < CARD_TITLES.length; idx++) {
    const t = norm(CARD_TITLES[idx]);
    const d = Math.min(lev(u, t), lev(u.replace(/\s+/g, ''), t.replace(/\s+/g, '')));
    if (d < bestScore) {
      bestScore = d;
      bestIdx = idx;
    }
    if (d <= 1) return idx; // early perfect/near-perfect
  }
  const tBest = norm(CARD_TITLES[bestIdx]);
  const tol = Math.min(3, Math.max(1, Math.floor(Math.max(tBest.length, 3) * 0.3)));
  return bestScore <= tol ? bestIdx : null;
}

// ✅ NEW: per-card links (replace per index as needed)
const DEFAULT_LINK = 'https://x.com'; // <- replace later
const CARD_LINKS = [
  'https://x.com/0xDeployer', // 0 deployer
  'https://vibechain.com/market', // 1 nico
  'https://www.youtube.com/watch?v=pKN9trFSACI', // 2 jc
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
];

// ----------------------------------

export default function SpeechController({ navRef, lang = 'en-US' }) {
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const recogRef = useRef(null);
  const keepAlive = useRef(true);
  const lastTriggerAt = useRef(0);
  const lastShownIdx = useRef(null); // best-effort fallback

  function triggerOnce(cb) {
    const now = performance.now();
    if (now - lastTriggerAt.current < 450) return false;
    lastTriggerAt.current = now;
    cb?.();
    return true;
  }

  function tryCardAliases(text) {
    for (const { re, idx } of CARD_PATTERNS) if (re.test(text)) return idx;
    for (const [idxStr, list] of Object.entries(CARD_ALIASES)) {
      const idx = Number(idxStr);
      for (const re of list) if (re.test(text)) return idx;
    }
    return fuzzyFindIndex(text);
  }

  // ✅ Try to get current active index from navRef, else use our last known
  function getCurrentIndex() {
    const nav = navRef?.current;
    if (!nav) return lastShownIdx.current;
    if (typeof nav.getActiveIndex === 'function') return nav.getActiveIndex();
    if (typeof nav.getIndex === 'function') return nav.getIndex();
    if (typeof nav.activeIndex === 'number') return nav.activeIndex;
    return lastShownIdx.current;
  }

  // ✅ Open the link for a given card index (new tab if allowed; else same tab)
  function openCardLink(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= CARD_LINKS.length) return;
    const url = CARD_LINKS[idx] || DEFAULT_LINK;
    window.open(url, '_blank');
  }

  function checkCommands(textRaw) {
    const text = textRaw.toLowerCase();

    // ✅ 1) "open link" command (optionally with a card name)
    if (OPEN_LINK_PATTERNS.some((p) => p.test(text))) {
      // If the utterance contains a recognizable card name, use that;
      // otherwise, use the current card from navRef/lastShown.
      let idx = tryCardAliases(text);
      if (!Number.isInteger(idx)) idx = getCurrentIndex();
      if (Number.isInteger(idx)) triggerOnce(() => openCardLink(idx));
      return;
    }

    // 2) Card names (aliases/fuzzy)
    const cardIdx = tryCardAliases(text);
    if (Number.isInteger(cardIdx)) {
      triggerOnce(() => {
        navRef?.current?.showByIndex?.(cardIdx);
        lastShownIdx.current = cardIdx; // keep in sync
      });
      return;
    }

    // 3) Next / Back
    if (NEXT_PATTERNS.some((p) => p.test(text))) {
      triggerOnce(() => {
        navRef?.current?.next?.();
        // Try to update lastShown after nav moves (best-effort)
        requestAnimationFrame(() => {
          const now = getCurrentIndex();
          if (Number.isInteger(now)) lastShownIdx.current = now;
        });
      });
      return;
    }
    if (BACK_PATTERNS.some((p) => p.test(text))) {
      triggerOnce(() => {
        navRef?.current?.prev?.();
        requestAnimationFrame(() => {
          const now = getCurrentIndex();
          if (Number.isInteger(now)) lastShownIdx.current = now;
        });
      });
      return;
    }
  }

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
      if (interim) setInterimText(interim.trim());
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

    return () => {
      keepAlive.current = false;
      try {
        rec.stop();
      } catch {}
    };
  }, [lang]);

  return (
    <Html fullscreen>
      <div className="pointer-events-none fixed bottom-44 inset-x-0 flex justify-center z-[9999]">
        <div className="min-w-[20vw] max-w-[20vw] rounded-2xl bg-black/70 backdrop-blur px-4 py-3 text-white text-sm shadow-lg">
          <div>{finalText || "Say a card name, 'open link', or 'next' / 'back'…"}</div>
          {interimText && <div className="mt-1 text-xs opacity-70">{interimText}</div>}
        </div>
      </div>
    </Html>
  );
}
