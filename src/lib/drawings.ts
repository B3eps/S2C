import type { Bar, DrawingKind } from './types';

export type ToolCat = 'lines' | 'channels' | 'pitchfork' | 'fib' | 'shapes' | 'position' | 'measure';

export interface ToolDef {
  kind: DrawingKind;
  cat: ToolCat;
  name: string;
  /** anchor points the user places: 1, 2 or 3 */
  points: 1 | 2 | 3;
  /** short explanation, only where a tool needs one */
  desc?: string;
  link?: string;
}

export const CATS: { id: ToolCat; name: string }[] = [
  { id: 'lines', name: 'Çizgiler' },
  { id: 'channels', name: 'Kanallar' },
  { id: 'pitchfork', name: 'Pitchfork' },
  { id: 'fib', name: 'Fibonacci' },
  { id: 'shapes', name: 'Şekiller' },
  { id: 'position', name: 'Pozisyon' },
  { id: 'measure', name: 'Ölçüm' },
];

export const TOOLS: ToolDef[] = [
  { kind: 'trend', cat: 'lines', name: 'Trend çizgisi', points: 2 },
  { kind: 'ray', cat: 'lines', name: 'Işın', points: 2, desc: 'İlk noktadan başlar, ikinci noktanın yönünde sağa doğru sonsuza uzar. Bir trendin devamını izlemek için.' },
  { kind: 'extended', cat: 'lines', name: 'Uzatılmış çizgi', points: 2, desc: 'İki noktadan geçip her iki yöne de uzanan çizgi.' },
  { kind: 'hline', cat: 'lines', name: 'Yatay çizgi', points: 1, desc: 'Tek bir seviye: destek, direnç ya da önemli bir dönüş noktası.' },
  { kind: 'hray', cat: 'lines', name: 'Yatay ışın', points: 1, desc: 'Tıkladığın mumdan sağa doğru uzanan yatay seviye. Seviyenin nereden doğduğunu gösterir.' },
  { kind: 'vline', cat: 'lines', name: 'Dikey çizgi', points: 1, desc: 'Bir anı işaretler: haber, seans açılışı ya da kırılım.' },
  { kind: 'cross', cat: 'lines', name: 'Çapraz çizgi', points: 1 },
  {
    kind: 'channel',
    cat: 'channels',
    name: 'Paralel kanal',
    points: 3,
    desc: 'Bir trend çizgisi ve ona paralel ikinci bir çizgi. Fiyatın iki sınır arasında gidip gelmesini izler. İki noktayla çizgiyi, üçüncü tıkla kanal genişliğini seç.',
    link: 'https://en.wikipedia.org/wiki/Trend_line_(technical_analysis)',
  },
  {
    kind: 'regression',
    cat: 'channels',
    name: 'Regresyon trendi',
    points: 2,
    desc: 'Seçtiğin aralıktaki kapanışlara en iyi oturan düz çizgi ve ±2 standart sapma bandı. Fiyat bandın dışına taşınca hareket aşırı sayılabilir.',
    link: 'https://en.wikipedia.org/wiki/Linear_regression',
  },
  {
    kind: 'pitchfork',
    cat: 'pitchfork',
    name: 'Andrews pitchfork',
    points: 3,
    desc: 'Üç dönüş noktasından çizilir: bir medyan çizgi ve iki paralel. Fiyatın medyana geri dönme eğilimini izler. Önce başlangıç dönüşü, sonra sonraki tepe ve dip.',
    link: 'https://en.wikipedia.org/wiki/Andrews%27_pitchfork',
  },
  {
    kind: 'fib',
    cat: 'fib',
    name: 'Fibonacci düzeltmesi',
    points: 2,
    desc: 'Bir hareketin geri çekilebileceği seviyeler: %23,6 · 38,2 · 50 · 61,8 · 78,6. Yükselişte dipten tepeye, düşüşte tepeden dibe sürükle.',
    link: 'https://en.wikipedia.org/wiki/Fibonacci_retracement',
  },
  { kind: 'rect', cat: 'shapes', name: 'Dikdörtgen', points: 2, desc: 'Bir bölgeyi işaretler: arz-talep alanı, konsolidasyon ya da açılış aralığı.' },
  {
    kind: 'longpos',
    cat: 'position',
    name: 'Long pozisyon',
    points: 2,
    desc: 'Planı önizler, emir açmaz. Giriş, hedef ve stop arasındaki mesafeyi ve risk/ödül oranını gösterir. Tutamaçlarla hedefi ve stopu ayarla.',
    link: 'https://www.investopedia.com/terms/r/riskrewardratio.asp',
  },
  {
    kind: 'shortpos',
    cat: 'position',
    name: 'Short pozisyon',
    points: 2,
    desc: 'Satış planını önizler, emir açmaz. Hedef girişin altında, stop üstündedir.',
    link: 'https://www.investopedia.com/terms/r/riskrewardratio.asp',
  },
  { kind: 'measure', cat: 'measure', name: 'Fiyat ve süre ölçümü', points: 2, desc: 'İki nokta arasındaki yüzde değişim ve mum sayısı. Fiyat gizliyken de çalışır.' },
];

export const TOOL_BY_KIND = Object.fromEntries(TOOLS.map((t) => [t.kind, t])) as Record<DrawingKind, ToolDef>;

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/** Least-squares line through closes between two times, with the residual standard deviation. */
export function regression(bars: Bar[], t1: number, t2: number) {
  const lo = Math.min(t1, t2);
  const hi = Math.max(t1, t2);
  const pts = bars.filter((b) => b.t >= lo && b.t <= hi);
  if (pts.length < 2) return null;
  const n = pts.length;
  const xs = pts.map((b) => b.t);
  const ys = pts.map((b) => b.c);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const at = (t: number) => my + slope * (t - mx);
  const sd = Math.sqrt(ys.reduce((a, y, i) => a + (y - at(xs[i])) ** 2, 0) / n);
  return { t1: xs[0], t2: xs[n - 1], at, sd };
}

/** Default stop for a position tool: half the target distance on the other side (R:R 2). */
export const defaultStop = (entry: number, target: number) => entry - (target - entry) / 2;
