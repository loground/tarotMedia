// components/SpeechController.jsx
import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';

// next/back (keep if you want both)
const NEXT_PATTERNS = [/\bnext\b/i, /\bforward\b/i, /след(ующая|ующий)/i, /далее/i];
const BACK_PATTERNS = [/\bback\b/i, /\bprevious\b/i, /назад/i, /предыдущ(ая|ий)/i];

// Name → index (0-based). Prefer longer phrases first.
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

export default function SpeechController({ navRef, lang = 'en-US' }) {
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const recogRef = useRef(null);
  const keepAlive = useRef(true);
  const lastTriggerAt = useRef(0);

  function triggerOnce(cb) {
    const now = performance.now();
    if (now - lastTriggerAt.current < 450) return false;
    lastTriggerAt.current = now;
    cb?.();
    return true;
  }

  function checkCommands(textRaw) {
    const text = textRaw.toLowerCase();

    // 1) Card names
    for (const { re, idx } of CARD_PATTERNS) {
      if (re.test(text)) {
        triggerOnce(() => navRef?.current?.showByIndex?.(idx));
        return; // stop on first match
      }
    }

    // 2) Next / Back
    if (NEXT_PATTERNS.some((p) => p.test(text))) {
      triggerOnce(() => navRef?.current?.next?.());
      return;
    }
    if (BACK_PATTERNS.some((p) => p.test(text))) {
      triggerOnce(() => navRef?.current?.prev?.());
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
          <div>{finalText || "Say a card name, or 'next' / 'back'…"}</div>
          {interimText && <div className="mt-1 text-xs opacity-70">{interimText}</div>}
        </div>
      </div>
    </Html>
  );
}
