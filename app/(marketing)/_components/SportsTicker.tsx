'use client'

const SPORTS = [
  'Football','Basketball','Baseball','Softball','Soccer',
  'Lacrosse','Wrestling','Track & Field','Volleyball',
  'Swimming','Tennis','Golf','Cross Country','Hockey',
]

export default function SportsTicker() {
  // Duplicate for seamless loop
  const items = [...SPORTS, ...SPORTS]

  return (
    <div className="bg-brand-black border-t border-b border-white/5 py-5 overflow-hidden">
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker 24s linear infinite; }
      `}</style>
      <div className="ticker-track flex gap-10 w-max">
        {items.map((sport, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/30">{sport}</span>
            <span className="gold-text text-xs">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}
