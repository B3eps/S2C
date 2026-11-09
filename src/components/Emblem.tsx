/**
 * The S2C hallmark: a cut-corner assay stamp with chamfered heavy letterforms,
 * split by one oblique stencil cut. Geometry is shared with public/brand/s2c-emblem.svg.
 */
export const EMBLEM_LETTERS =
  'M27.6 11.6H17.6L13.6 15.6V16.6L17 20H22L25.4 23.4V24.4L21.4 28.4H11.4' +
  'M33 11.6H43.4L47.4 15.6V18.6L35.8 28.4H50.2' +
  'M72.2 11.6H61.6L57.6 15.6V24.4L61.6 28.4H72.2';
export const EMBLEM_FRAME = 'M6 1H78L83 6V34L78 39H6L1 34V6Z';

export function Emblem({ width = 84, color = 'var(--gold)', title = 'S2C' }: { width?: number; color?: string; title?: string }) {
  const id = 'cut-' + Math.round(width);
  return (
    <svg width={width} height={(width * 40) / 84} viewBox="0 0 84 40" role="img" aria-label={title}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse">
          <rect x="-2" y="-2" width="88" height="44" fill="#fff" />
          <path d="M8 32.5L76 7" stroke="#000" strokeWidth="1.6" />
        </mask>
      </defs>
      <g mask={`url(#${id})`} fill="none" stroke={color}>
        <path d={EMBLEM_FRAME} strokeWidth="1.6" />
        <path d={EMBLEM_LETTERS} strokeWidth="5.2" strokeLinejoin="miter" strokeMiterlimit="8" />
      </g>
    </svg>
  );
}
