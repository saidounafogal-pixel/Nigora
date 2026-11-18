// Dégradés « photo » évoquant le Sahel (dunes, coucher de soleil, nuit) — légers et disponibles hors ligne
export const SCENES = [
  'radial-gradient(120% 80% at 70% 0%, #ffb15c 0%, #e05206 30%, #6b1d0b 62%, #120604 100%)',
  'radial-gradient(120% 90% at 20% 10%, #f6d48b 0%, #c96a2b 35%, #3b1d3a 70%, #0b0614 100%)',
  'radial-gradient(110% 80% at 80% 20%, #7fd1c7 0%, #2f7d6d 35%, #11312e 70%, #050b0a 100%)',
  'radial-gradient(120% 90% at 30% 0%, #c7b4ff 0%, #6b4bd6 35%, #22164a 70%, #07050f 100%)',
]

/** Silhouette de dunes en bas des cartes */
export function Dunes() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 w-full" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path d="M0 120 C80 80 140 110 210 95 C280 80 330 60 400 85 L400 200 L0 200Z" fill="#000" opacity="0.25" />
      <path d="M0 150 C70 120 150 150 230 128 C300 110 350 125 400 115 L400 200 L0 200Z" fill="#000" opacity="0.35" />
      <rect width="400" height="200" fill="url(#dg)" />
    </svg>
  )
}
