"use client";

const DEFAULT_BRANDS = [
  "Rick Owens",
  "Yohji Yamamoto",
  "Comme des Garçons",
  "Maison Margiela",
  "Ann Demeulemeester",
  "Julius",
  "Issey Miyake",
  "Craig Green",
  "Dries Van Noten",
  "Acne Studios",
  "Lemaire",
  "Y-3",
  "Jil Sander",
  "Haider Ackermann",
  "Raf Simons",
];

interface MarqueeProps {
  items?: string[];
  className?: string;
}

export function Marquee({ items = DEFAULT_BRANDS, className = "" }: MarqueeProps) {
  const track = [...items, ...items];

  return (
    <div className={`overflow-hidden ${className}`} aria-hidden>
      <div className="flex w-max animate-marquee">
        {track.map((brand, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-5 px-5 font-sans text-[10px] uppercase tracking-[0.28em] text-black/40 dark:text-white/45"
          >
            {brand}
            <span className="inline-block h-[3px] w-[3px] rounded-full bg-black/20 dark:bg-white/25" />
          </span>
        ))}
      </div>
    </div>
  );
}
