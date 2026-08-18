export function ClapperboardMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="14" width="32" height="22" rx="6" fill="#312A63" />
      <rect x="4" y="6" width="32" height="11" rx="5" fill="#8B72D8" transform="rotate(-6 20 11.5)" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={7 + i * 8}
          y="4"
          width="4"
          height="11"
          fill="#FFF9F2"
          transform={`rotate(-6 20 11.5) skewX(-18) translate(${i === 0 ? -2 : 0} 0)`}
        />
      ))}
      <circle cx="20" cy="26" r="6" fill="#FFF9F2" />
      <path d="M18 23.5L24 26L18 28.5Z" fill="#312A63" />
    </svg>
  );
}

export function ProductionLogo({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <ClapperboardMark size={size} />
      {wordmark && (
        <span className="leading-[0.95]">
          <span className="block text-sm font-bold text-foreground lowercase tracking-tight">production</span>
          <span className="block text-sm font-bold text-primary lowercase tracking-tight">rescue</span>
        </span>
      )}
    </div>
  );
}
