/**
 * Inline SVG cartoon mage + book for the boot splash.
 * Server-safe (no client hooks) so it paints in the initial HTML.
 */
export function BootSplashMage() {
  return (
    <svg
      className="boot-mage"
      viewBox="0 0 200 200"
      width="160"
      height="160"
      aria-hidden="true"
      role="img"
    >
      <title>Página mage with a book</title>

      {/* Soft ground shadow */}
      <ellipse className="boot-ground" cx="100" cy="178" rx="48" ry="8" fill="#000" opacity="0.12" />

      {/* Floating sparkles */}
      <g className="boot-sparkles" fill="#c8f542" stroke="#000" strokeWidth="2" strokeLinejoin="round">
        <path className="boot-spark boot-spark-a" d="M28 42l3.2 7.2 7.8 1.2-6 5.4 1.8 7.6L28 59.2l-6.8 4.2 1.8-7.6-6-5.4 7.8-1.2z" />
        <path className="boot-spark boot-spark-b" d="M168 36l2.4 5.4 5.8.9-4.5 4 1.3 5.7L168 49l-5 3 1.3-5.7-4.5-4 5.8-.9z" />
        <path className="boot-spark boot-spark-c" d="M178 88l2 4.4 4.8.7-3.7 3.3 1.1 4.6L178 98.4l-4.2 2.5 1.1-4.6-3.7-3.3 4.8-.7z" />
        <circle className="boot-dot boot-dot-a" cx="42" cy="110" r="3.5" fill="#3b5bff" />
        <circle className="boot-dot boot-dot-b" cx="160" cy="130" r="2.8" fill="#ff4d9a" />
        <circle className="boot-dot boot-dot-c" cx="52" cy="58" r="2.4" fill="#ff8a1f" />
      </g>

      {/* Mage body group — bob */}
      <g className="boot-mage-bob">
        {/* Robe */}
        <path
          d="M72 118c-4 22-2 42 6 52h44c8-10 10-30 6-52-8-6-22-10-28-10s-20 4-28 10z"
          fill="#3b5bff"
          stroke="#000"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M86 128c4 8 8 22 10 38M114 128c-4 8-8 22-10 38"
          fill="none"
          stroke="#000"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.35"
        />
        {/* Lime sash */}
        <path
          d="M74 126c8-4 44-4 52 0-2 6-8 10-26 10s-24-4-26-10z"
          fill="#c8f542"
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Arms */}
        <path
          className="boot-arm-left"
          d="M78 122c-14 4-22 16-20 28"
          fill="none"
          stroke="#000"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          className="boot-arm-right"
          d="M122 120c12 2 22 10 26 22"
          fill="none"
          stroke="#000"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Head */}
        <circle cx="100" cy="88" r="28" fill="#fff" stroke="#000" strokeWidth="3" />
        {/* Cheeks */}
        <circle cx="84" cy="94" r="5" fill="#ff4d9a" opacity="0.35" />
        <circle cx="116" cy="94" r="5" fill="#ff4d9a" opacity="0.35" />
        {/* Eyes */}
        <g stroke="#000" strokeWidth="3" strokeLinecap="round">
          <path d="M88 86c2-3 6-3 8 0" fill="none" />
          <path d="M104 86c2-3 6-3 8 0" fill="none" />
          <circle cx="92" cy="90" r="2.2" fill="#000" stroke="none" />
          <circle cx="108" cy="90" r="2.2" fill="#000" stroke="none" />
        </g>
        {/* Smile */}
        <path d="M92 100c4 5 12 5 16 0" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />

        {/* Hat */}
        <g className="boot-hat">
          <path
            d="M68 78c4-4 10-8 32-8s28 4 32 8c-6 4-18 8-32 8s-26-4-32-8z"
            fill="#c8f542"
            stroke="#000"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M78 72c6-28 14-44 22-52 4 10 12 28 22 52"
            fill="#3b5bff"
            stroke="#000"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="100" cy="34" r="6" fill="#c8f542" stroke="#000" strokeWidth="2.5" />
          <path
            d="M100 28l1.6 3.6 4 .6-3 2.7.8 3.8L100 36.6l-3.4 2.1.8-3.8-3-2.7 4-.6z"
            fill="#000"
          />
        </g>

        {/* Open book in left hand */}
        <g className="boot-book" transform="translate(42 138)">
          {/* Shadow under book */}
          <ellipse cx="22" cy="28" rx="20" ry="4" fill="#000" opacity="0.1" />
          {/* Left page */}
          <path
            className="boot-page-l"
            d="M22 4c-10 2-20 4-20 8v14c0 4 10 6 20 4z"
            fill="#fff"
            stroke="#000"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Right page */}
          <path
            className="boot-page-r"
            d="M22 4c10 2 20 4 20 8v14c0 4-10 6-20 4z"
            fill="#fdfceb"
            stroke="#000"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Spine */}
          <path d="M22 4v26" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          {/* Scribble lines */}
          <path d="M8 14h8M8 18h6M8 22h7" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
          <path d="M28 14h8M28 18h6M28 22h7" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
          {/* Lime bookmark */}
          <path d="M18 2v10l4-3 4 3V2" fill="#c8f542" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
        </g>

        {/* Wand in right hand */}
        <g className="boot-wand" transform="translate(140 136)">
          <path d="M0 8 L28 -18" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
          <path d="M0 8 L28 -18" fill="none" stroke="#ff8a1f" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          <g className="boot-wand-tip">
            <path
              d="M28 -24l2.2 5 5.4.8-4.1 3.7 1.2 5.2L28 -7.4l-4.7 2.9 1.2-5.2-4.1-3.7 5.4-.8z"
              fill="#c8f542"
              stroke="#000"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}
