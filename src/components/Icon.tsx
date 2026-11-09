import type { CSSProperties } from 'react';

/** S2C icon set: 20×20 grid, 1.5 stroke, square caps, mitred joins. Drawn for this app. */
const P: Record<string, JSX.Element> = {
  panel: (
    <>
      <path d="M3.75 3.75h5.5v7.5h-5.5zM10.75 3.75h5.5v3.5h-5.5zM10.75 8.75h5.5v7.5h-5.5zM3.75 12.75h5.5v3.5h-5.5z" />
    </>
  ),
  trade: (
    <>
      <path d="M6.5 2.5v2.75M6.5 13v4.5M13.5 3.5v3M13.5 12.5v4" />
      <path d="M4.75 5.25h3.5V13h-3.5zM11.75 6.5h3.5v6h-3.5z" />
    </>
  ),
  journal: <path d="M4.25 2.75h9.5l2 2v12.5H4.25zM7.25 2.75v14.5M9.75 7h3.5M9.75 10h3.5" />,
  stats: <path d="M2.75 17.25h14.5M5.25 14.25v-3.5M9.25 14.25v-8M13.25 14.25v-5.5M17.25 14.25V3" />,
  settings: (
    <>
      <path d="M2.75 6h14.5M2.75 14h14.5" />
      <path d="M6 3.75h2.5v4.5H6zM11.5 11.75H14v4.5h-2.5z" fill="currentColor" />
    </>
  ),
  cursor: <path d="M5 2.75l10.5 6.5-4.75 1.5-2.5 4.5z" />,
  trend: (
    <>
      <path d="M5.25 14.75l9.5-9.5" />
      <path d="M2.75 14.25h3v3h-3zM14.25 2.75h3v3h-3z" />
    </>
  ),
  hline: (
    <>
      <path d="M1.75 10h6.5M11.75 10h6.5" />
      <path d="M8.25 8.25h3.5v3.5h-3.5z" />
    </>
  ),
  rect: (
    <>
      <path d="M5.25 5.75h9.5v8.5h-9.5z" />
      <path d="M3.25 3.75h3v3h-3zM13.75 13.25h3v3h-3z" fill="currentColor" />
    </>
  ),
  trash: <path d="M3.75 5.75h12.5M8 5.75v-2.5h4v2.5M5.75 5.75l1 11h6.5l1-11M8.75 8.75v5M11.25 8.75v5" />,
  play: <path d="M5.75 3.75l10 6.25-10 6.25z" fill="currentColor" />,
  pause: <path d="M5.25 3.75h3v12.5h-3zM11.75 3.75h3v12.5h-3z" fill="currentColor" />,
  step: (
    <>
      <path d="M4.25 3.75l8.5 6.25-8.5 6.25z" fill="currentColor" />
      <path d="M15.5 3.75v12.5" />
    </>
  ),
  wave: (
    <>
      <path d="M1.75 13c2.5 0 3-6.25 5.75-6.25S10 14.5 12.75 14.5s3-5.25 5.5-5.25" />
      <path d="M2.75 17.25h14.5" />
    </>
  ),
  single: <path d="M2.75 3.75h14.5v12.5H2.75z" />,
  dual: <path d="M2.75 3.75h14.5v12.5H2.75zM10 3.75v12.5" />,
  soundOn: <path d="M2.75 7.75h3l4-3.25v11l-4-3.25h-3zM12.75 7a4.25 4.25 0 010 6M15 4.75a7.5 7.5 0 010 10.5" />,
  soundOff: <path d="M2.75 7.75h3l4-3.25v11l-4-3.25h-3zM12.75 7.75l4.5 4.5M17.25 7.75l-4.5 4.5" />,
  plus: <path d="M10 3.75v12.5M3.75 10h12.5" />,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  chevron: <path d="M5.5 8l4.5 4.5L14.5 8" />,
  camera: (
    <>
      <path d="M2.75 6.25h3.5l1.5-2.5h4.5l1.5 2.5h3.5v10H2.75z" />
      <path d="M10 8.5a2.75 2.75 0 110 5.5 2.75 2.75 0 010-5.5z" />
    </>
  ),
  replay: <path d="M4.25 10a5.75 5.75 0 102.1-4.45M3.75 2.75v3.5h3.5" />,
  download: <path d="M10 2.75v10M5.75 8.75l4.25 4.25 4.25-4.25M3.75 17.25h12.5" />,
  upload: <path d="M10 13.25v-10M5.75 7.25L10 3l4.25 4.25M3.75 17.25h12.5" />,
  up: <path d="M10 16.25V4.25M5 9.25l5-5 5 5" />,
  down: <path d="M10 3.75v12M5 10.75l5 5 5-5" />,
  flag: <path d="M5.25 17.25V2.75M5.25 3.75h10l-2.25 3.5 2.25 3.5h-10" />,
  clock: (
    <>
      <path d="M10 2.75a7.25 7.25 0 110 14.5 7.25 7.25 0 010-14.5z" />
      <path d="M10 6v4.25l2.75 1.75" />
    </>
  ),
  eye: (
    <>
      <path d="M1.75 10S4.75 4.75 10 4.75 18.25 10 18.25 10 15.25 15.25 10 15.25 1.75 10 1.75 10z" />
      <path d="M10 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" />
    </>
  ),
  eyeOff: <path d="M1.75 10S4.75 4.75 10 4.75 18.25 10 18.25 10 15.25 15.25 10 15.25 1.75 10 1.75 10zM3.25 16.75l13.5-13.5" />,
  search: <path d="M8.75 3.75a5 5 0 110 10 5 5 0 010-10zM12.5 12.5l4.75 4.75" />,
  warn: <path d="M10 2.75l8 14.5H2zM10 8v4.25M10 14.25v1" />,
  lock: <path d="M4.25 9.25h11.5v8H4.25zM6.75 9.25V6.5a3.25 3.25 0 016.5 0v2.75" />,
  seal: (
    <>
      <path d="M10 2.25a5.75 5.75 0 110 11.5 5.75 5.75 0 010-11.5z" />
      <path d="M6.75 12.5l-1.75 5 3-1.25 2 2.25M13.25 12.5l1.75 5-3-1.25-2 2.25M10 5.5v5M7.5 8h5" />
    </>
  ),
  coin: (
    <>
      <path d="M10 3.25c3.3 0 6 1.1 6 2.5s-2.7 2.5-6 2.5-6-1.1-6-2.5 2.7-2.5 6-2.5z" />
      <path d="M4 5.75v4.25c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5.75M4 10v4.25c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V10" />
    </>
  ),
  pencil: <path d="M3.75 16.25l.75-3.75 8.75-8.75 3 3-8.75 8.75zM11.25 5.75l3 3" />,
  sliders: <path d="M5 2.75v14.5M10 2.75v14.5M15 2.75v14.5M3 12h4M8 6.5h4M13 10.5h4" />,
  calendar: <path d="M2.75 4.75h14.5v12.5H2.75zM2.75 8.25h14.5M6.25 2.75v3.5M13.75 2.75v3.5" />,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, style, className }: { name: IconName; size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
      style={{ flex: 'none', ...style }}
    >
      {P[name]}
    </svg>
  );
}
