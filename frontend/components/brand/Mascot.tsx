/**
 * "Biscuit" — Production Rescue's mascot, an original corgi assistant
 * director. Cream/orange corgi, white muzzle and chest, purple production
 * cap and headset, expressive brows. Not a reproduction of any existing
 * character; designed from scratch for this product.
 */
export function Mascot({
  pose = "idle",
  size = 120,
  className,
}: {
  pose?: "idle" | "thinking" | "warning" | "celebrating";
  size?: number;
  className?: string;
}) {
  const browTilt = pose === "warning" ? -6 : pose === "thinking" ? -3 : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Biscuit, the Production Rescue corgi"
    >
      {/* ground shadow */}
      <ellipse cx="80" cy="149" rx="38" ry="7" fill="#312A63" opacity="0.08" />

      {/* body */}
      <path d="M40 156C40 126 57 108 80 108C103 108 120 126 120 156Z" fill="#FFF9F2" stroke="#F0C69A" strokeWidth="2" />
      <path d="M52 156C52 134 64 122 80 122C96 122 108 134 108 156Z" fill="#F2B884" opacity="0.5" />

      {/* ears */}
      <path d="M35 46C24 30 26 12 38 8C46 22 46 38 48 50Z" fill="#EFA35F" />
      <path d="M125 46C136 30 134 12 122 8C114 22 114 38 112 50Z" fill="#EFA35F" />
      <path d="M39 40C32 29 33 17 40 14C45 24 45 34 46 42Z" fill="#FBE0C4" />
      <path d="M121 40C128 29 127 17 120 14C115 24 115 34 114 42Z" fill="#FBE0C4" />

      {/* head */}
      <ellipse cx="80" cy="78" rx="46" ry="42" fill="#F2B168" />
      {/* muzzle / chest patch */}
      <path d="M46 82C46 106 62 118 80 118C98 118 114 106 114 82C114 100 100 108 80 108C60 108 46 100 46 82Z" fill="#FFF6E8" />

      {/* purple production cap */}
      <path d="M36 54C36 34 55 20 80 20C105 20 124 34 124 54C124 58 121 60 117 60H43C39 60 36 58 36 54Z" fill="#8B72D8" />
      <path d="M32 58C32 54 40 52 80 52C120 52 128 54 128 58C128 62 120 63 80 63C40 63 32 62 32 58Z" fill="#7461C4" />
      <circle cx="80" cy="30" r="4" fill="#B8A8EB" />

      {/* headset band + cups */}
      <path d="M40 62C40 46 56 34 80 34C104 34 120 46 120 62" stroke="#312A63" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="70" r="9" fill="#312A63" />
      <circle cx="120" cy="70" r="9" fill="#312A63" />
      <circle cx="40" cy="70" r="4" fill="#8B72D8" />
      <circle cx="120" cy="70" r="4" fill="#8B72D8" />
      {pose === "thinking" && (
        <path d="M40 76C36 84 40 92 50 94" stroke="#312A63" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}

      {/* eyebrows */}
      <path
        d={`M60 68 q7 ${-6 + browTilt} 14 0`}
        stroke="#8A5A2B" strokeWidth="3.5" fill="none" strokeLinecap="round"
        transform={pose === "warning" ? "rotate(-8 67 68)" : undefined}
      />
      <path
        d={`M86 68 q7 ${-6 + browTilt} 14 0`}
        stroke="#8A5A2B" strokeWidth="3.5" fill="none" strokeLinecap="round"
        transform={pose === "warning" ? "rotate(8 93 68)" : undefined}
      />

      {/* eyes */}
      <ellipse cx="67" cy="80" rx="5" ry="6.5" fill="#25233A" />
      <ellipse cx="93" cy="80" rx="5" ry="6.5" fill="#25233A" />
      <circle cx="69" cy="77.5" r="1.6" fill="#fff" />
      <circle cx="95" cy="77.5" r="1.6" fill="#fff" />

      {/* blush */}
      <ellipse cx="56" cy="94" rx="7" ry="4.5" fill="#FF8D8D" opacity="0.45" />
      <ellipse cx="104" cy="94" rx="7" ry="4.5" fill="#FF8D8D" opacity="0.45" />

      {/* nose + mouth */}
      <ellipse cx="80" cy="93" rx="5" ry="3.5" fill="#25233A" />
      {pose === "celebrating" ? (
        <path d="M68 99 Q80 112 92 99" stroke="#25233A" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M72 99 Q80 105 88 99" stroke="#25233A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}

      {/* prop: clapperboard (idle) */}
      {pose === "idle" && (
        <g transform="translate(104 108) rotate(18)">
          <rect x="0" y="8" width="26" height="18" rx="2" fill="#25233A" />
          <rect x="0" y="0" width="26" height="8" rx="2" fill="#25233A" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={2 + i * 6} y="0" width="3" height="8" fill="#FFF9F2" transform={`skewX(-20)`} />
          ))}
        </g>
      )}

      {/* prop: megaphone (warning) */}
      {pose === "warning" && (
        <g transform="translate(100 104) rotate(-12)">
          <path d="M0 10 L18 0 L18 26 L0 16 Z" fill="#25233A" />
          <rect x="-6" y="11" width="8" height="5" rx="1.5" fill="#25233A" />
          <path d="M18 2 L26 -3 L26 29 L18 24 Z" fill="#F45F68" opacity="0.85" />
        </g>
      )}

      {/* celebration confetti (film-strip squares) */}
      {pose === "celebrating" && (
        <>
          <rect x="18" y="30" width="7" height="7" rx="1.5" fill="#FFD978" transform="rotate(18 21 33)" />
          <rect x="132" y="26" width="7" height="7" rx="1.5" fill="#A8C89B" transform="rotate(-12 135 29)" />
          <rect x="24" y="60" width="6" height="6" rx="1.5" fill="#FF8D8D" transform="rotate(-20 27 63)" />
          <rect x="128" y="64" width="6" height="6" rx="1.5" fill="#8B72D8" transform="rotate(15 131 67)" />
        </>
      )}
    </svg>
  );
}
