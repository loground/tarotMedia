import { Html, useProgress } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';

export default function LoaderOverlay() {
  const { active, progress, loaded, total, item } = useProgress();
  const [visible, setVisible] = useState(true);

  // Smoothly hide the overlay after loading completes
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setVisible(false), 300); // let the bar reach 100%
      return () => clearTimeout(t);
    }
  }, [active, progress]);

  // Keep numbers tidy
  const pct = useMemo(() => Math.min(100, Math.round(progress)), [progress]);

  if (!visible) return null;

  return (
    <Html center style={{ pointerEvents: 'none' }}>
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.title}>Loading</span>
            <span style={styles.pct}>{pct}%</span>
          </div>
          <div style={styles.barOuter}>
            <div style={{ ...styles.barInner, width: `${pct}%` }} />
          </div>
          <div style={styles.meta}>
            <span>
              {loaded}/{total} assets
            </span>
            <span style={styles.item} title={item || ''}>
              {item ? trimMiddle(item, 48) : '\u00A0'}
            </span>
          </div>
        </div>
      </div>
    </Html>
  );
}

// -------- inline styles (keeps it self-contained) ----------
const styles = {
  backdrop: {
    background: 'rgba(0,0,0,0.35)',
    padding: 24,
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    minWidth: 280,
    maxWidth: 420,
    transform: 'translateY(-40px)',
    backdropFilter: 'blur(4px)',
  },
  card: { display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' },
  row: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: 'spFont', fontSize: 18, fontWeight: 600, color: '#fff' },
  pct: { fontFamily: 'spFont', color: '#fff' },
  barOuter: {
    height: 8,
    width: '100%',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    background: '#8b5cf6', // violet-500 (change to taste)
    borderRadius: 999,
    transition: 'width 120ms ease',
  },
  meta: {
    fontFamily: 'spFont',
    display: 'flex',
    justifyContent: 'space-between',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    gap: 8,
  },
  item: {
    fontFamily: 'spFont',
    maxWidth: 240,
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

// Utility: trim long URLs/paths in the middle
function trimMiddle(str, max = 48) {
  if (!str || str.length <= max) return str || '';
  const half = Math.floor((max - 3) / 2);
  return `${str.slice(0, half)}...${str.slice(-half)}`;
}
