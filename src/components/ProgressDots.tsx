"use client";

interface Props {
  phases: string[];
  current: number;
}

export default function ProgressDots({ phases, current }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {phases.map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i <= current
              ? "w-2.5 h-2.5 bg-drd-amber"
              : "w-2 h-2 bg-white/10"
          } ${i === current ? "scale-140" : ""}`}
        >
          {i <= current && (
            <span className="sr-only">✓</span>
          )}
        </div>
      ))}
    </div>
  );
}
