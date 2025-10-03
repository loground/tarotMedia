import React from 'react';

import { Html } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';

function ParkDexChart() {
  const tokenAddress = '0x55EbE388F17936a07D430E33D50e6870d8c1EDEB'; // Corrected token address for $PARK
  const preferredDex = 'uniswap';
  const chainId = 'base';
  const title = '$PARK LIVE CHART';

  const [pairs, setPairs] = useState(null);
  const [error, setError] = useState(null);

  // Fetch pairs for the token
  useEffect(() => {
    let done = false;
    async function run() {
      try {
        setError(null);
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!done) setPairs(Array.isArray(data?.pairs) ? data.pairs : []);
      } catch (e) {
        if (!done) setError(e?.message || 'Failed to load pairs');
      }
    }
    run();
    return () => {
      done = true;
    };
  }, [tokenAddress]);

  // Choose the best pair: prefer Uniswap on Base, else highest liquidity on Base
  const chosen = useMemo(() => {
    if (!pairs || pairs.length === 0) return null;
    const onChain = pairs.filter((p) => p.chainId?.toLowerCase() === chainId.toLowerCase());
    const byDex = onChain.find((p) => p.dexId?.toLowerCase() === preferredDex.toLowerCase());
    if (byDex) return byDex;
    return onChain.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0] || null;
  }, [pairs, chainId, preferredDex]);

  // Build iframe src with params for cleaner chart view (hides info/chat panels)
  const iframeSrc = useMemo(() => {
    if (!chosen) return null;
    return `https://dexscreener.com/${chosen.chainId}/${chosen.pairAddress}?embed=1&theme=dark&info=0&chat=0&trades=0`;
  }, [chosen]);

  // External open target
  const openUrl =
    chosen?.url ||
    (chosen && `https://dexscreener.com/${chosen.chainId}/${chosen.pairAddress}`) ||
    '';

  return (
    <div className="w-[140vw] h-[60vh] max-w-[800px] max-h-[600px] relative rounded-none border-4 border-black bg-black">
      {/* red header bar - scaled down */}
      <div className="mb-1 flex items-center justify-between ">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-white" />
          <span className="font-bold text-white text-xs">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* open in new tab */}
          {openUrl && (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="grid h-4 w-4 place-items-center bg-black/30 text-white hover:bg-black/50 text-xs"
              aria-label="Open on Dexscreener"
              title="Open on Dexscreener">
              ↗
            </a>
          )}
        </div>
      </div>

      {/* inner white border box */}
      <div className="rounded-sm border-2 border-white h-full w-full">
        {error && (
          <div className="p-2 text-center text-white text-xs">
            <p className="font-semibold">Couldn’t load Dexscreener data.</p>
            <p className="text-xs opacity-70">{error}</p>
          </div>
        )}

        {!error && !iframeSrc && (
          <div className="p-2 text-center text-white text-xs h-full flex items-center justify-center">
            <div className="mx-auto mb-1 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            <p>Loading chart…</p>
          </div>
        )}

        {!error && iframeSrc && (
          <iframe
            title="Dexscreener Chart"
            src={iframeSrc}
            className="h-full w-full"
            loading="lazy"
            allow="clipboard-read; clipboard-write; fullscreen;"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>

      {/* Tiny meta row (optional, scaled down) */}
      {chosen && (
        <div className="mt-1 flex flex-wrap items-center justify-between text-xs text-slate-300 absolute bottom-1 left-1 right-1">
          <span className="text-[10px]">
            {chosen.baseToken?.symbol} / {chosen.quoteToken?.symbol} on {chosen.dexId}
          </span>
          <span className="text-[10px]">
            Liq: ${Intl.NumberFormat().format(Math.round(chosen.liquidity?.usd || 0))}
          </span>
        </div>
      )}
    </div>
  );
}

export function ChartInScene({ uProgression = 0 }) {
  const [interactive, setInteractive] = React.useState(false);
  const opacity = Math.abs(uProgression - 1) < 0.01 ? 1 : 0;

  return (
    <>
      {/* Small toggle button near the screen (always clickable) */}
      <Html
        center
        transform
        position={[5.2, -1.7, -3.669]} // slight offset above the desk
        zIndexRange={[10, 0]} // above the chart's Html so it’s always tappable
        style={{ opacity }}>
        <button
          onClick={() => setInteractive((v) => !v)}
          className={`px-2 py-2 font-sp text-[10px] rounded-md border
              ${
                interactive
                  ? 'bg-green-600 border-white text-white'
                  : 'bg-black/60 border-white/40 text-white/90'
              }
            `}
          title={interactive ? 'Disable chart interactions' : 'Enable chart interactions'}>
          {interactive ? 'Use Chart: ON' : 'Use Chart: OFF'}
        </button>
      </Html>

      {/* The chart itself */}
      <Html
        center
        transform
        occlude // hides when a closer mesh is between it and the camera
        zIndexRange={[0, 0]} // keep this Html low in the DOM stack
        distanceFactor={1}
        scale={2.5} // Reduced scale to prevent oversized overlay
        position={[0, 0, 0]} // Relative to the parent group
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          opacity,
        }} // gate pointer events
        onOcclude={(hidden) => {
          // if something occludes the screen, auto-disable interaction
          if (hidden) setInteractive(false);
        }}>
        <ParkDexChart />
      </Html>
    </>
  );
}
