/** Original vector action icons — not Unicode/emoji. */

export function IconSkip({ color = "#f4f1ea" }: { color?: string }) {
  return (
    <g>
      <circle cx="0" cy="0" r="22" fill="none" stroke={color} strokeWidth="5" />
      <line x1="-16" y1="16" x2="16" y2="-16" stroke={color} strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}

export function IconReverse({ color = "#f4f1ea" }: { color?: string }) {
  return (
    <g>
      <path
        d="M -18 -4 A 18 18 0 0 1 14 -10"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M 14 -10 L 6 -18 L 4 -6 Z" fill={color} />
      <path
        d="M 18 4 A 18 18 0 0 1 -14 10"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M -14 10 L -6 18 L -4 6 Z" fill={color} />
    </g>
  );
}

export function IconDrawTwo({ color = "#f4f1ea" }: { color?: string }) {
  return (
    <g>
      <rect x="-20" y="-8" width="18" height="26" rx="3" fill={color} opacity="0.9" transform="rotate(-12 -11 5)" />
      <rect x="0" y="-14" width="18" height="26" rx="3" fill={color} opacity="0.75" transform="rotate(10 9 -1)" />
      <text
        x="0"
        y="28"
        textAnchor="middle"
        fill={color}
        fontFamily="Barlow Condensed, Impact, sans-serif"
        fontWeight="800"
        fontSize="16"
      >
        +2
      </text>
    </g>
  );
}

export function IconWild() {
  const colors = ["#c93c3c", "#d4a824", "#2f9e5f", "#2f6fbf"];
  return (
    <g>
      {colors.map((c, i) => {
        const a = (i * Math.PI) / 2 - Math.PI / 4;
        const x = Math.cos(a) * 10;
        const y = Math.sin(a) * 10;
        return <circle key={c} cx={x} cy={y} r="11" fill={c} />;
      })}
      <circle cx="0" cy="0" r="7" fill="#f4f1ea" opacity="0.9" />
    </g>
  );
}

export function IconWild4() {
  return (
    <g>
      <g transform="translate(-12,-10) scale(0.55)">
        <IconWild />
      </g>
      <g transform="translate(10,-12) scale(0.55)">
        <IconWild />
      </g>
      <g transform="translate(-10,10) scale(0.55)">
        <IconWild />
      </g>
      <g transform="translate(12,8) scale(0.55)">
        <IconWild />
      </g>
      <text
        x="0"
        y="36"
        textAnchor="middle"
        fill="#f4f1ea"
        fontFamily="Barlow Condensed, Impact, sans-serif"
        fontWeight="800"
        fontSize="15"
      >
        +4
      </text>
    </g>
  );
}
