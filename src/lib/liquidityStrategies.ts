import type { Bar } from './types';
import { aggregate } from './candles';

/** Independent research engine. All timestamps are UTC milliseconds; only closed bars are read. */
export type LiquiditySignal = { variant: 1 | 2 | 3; time: number; side: 'long' | 'short'; entry: number; stop: number; target: number; sweepTime: number };
type Pivot = { price: number; time: number; high: boolean; taken?: boolean };
type Zone = { lo: number; hi: number; side: 1 | -1; time: number; kind: 'FVG' | 'OB' | 'iFVG' };
type Frame = { bars: Bar[]; pivots: Pivot[]; zones: Zone[]; bosUp: number; bosDown: number };
type Pending = { side: 1 | -1; sweepTime: number; extreme: number; target: number; level: number; done: boolean };
const MIN=60_000, H=60*MIN;
const fresh = (): Frame => ({ bars: [], pivots: [], zones: [], bosUp: -Infinity, bosDown: -Infinity });

function update(f: Frame, b: Bar, width: number, age: number) {
  const a=f.bars, prev=a[a.length-1]; a.push(b);
  for (const p of f.pivots) if (p.time <= b.t && (p.high ? b.h > p.price : b.l < p.price)) p.taken = true;
  // A two-sided pivot is only known after two subsequent candles have closed.
  const k=a.length-3;
  if(k>=2) {
    const p=a[k], around=[a[k-2],a[k-1],a[k+1],a[k+2]];
    if(around.every(x=>p.h>x.h)) f.pivots.push({price:p.h,time:p.t+3*width,high:true});
    if(around.every(x=>p.l<x.l)) f.pivots.push({price:p.l,time:p.t+3*width,high:false});
  }
  f.pivots=f.pivots.filter(p=>p.time>=b.t+width-age);
  f.zones=f.zones.filter(z=>z.time>=b.t+width-age);
  // A close through a zone turns an FVG into an inverse FVG; invalidated OBs are removed.
  f.zones=f.zones.flatMap(z=> {
    const broken=z.side===1 ? b.c<z.lo : b.c>z.hi;
    if(!broken) return [z];
    return z.kind==='FVG' ? [{...z,side:(-z.side) as 1|-1,kind:'iFVG' as const,time:b.t+width}] : [];
  });
  if(a.length>=3) {
    const old=a[a.length-3];
    if(b.l>old.h) f.zones.push({lo:old.h,hi:b.l,side:1,time:b.t+width,kind:'FVG'});
    if(b.h<old.l) f.zones.push({lo:b.h,hi:old.l,side:-1,time:b.t+width,kind:'FVG'});
  }
  const hi=[...f.pivots].reverse().find(p=>p.high && p.time<=b.t);
  const lo=[...f.pivots].reverse().find(p=>!p.high && p.time<=b.t);
  if(prev && hi && prev.c<=hi.price && b.c>hi.price) {
    f.bosUp=b.t+width;
    const ob=a.slice(Math.max(0,a.length-6),-1).reverse().find(x=>x.c<x.o);
    if(ob) f.zones.push({lo:ob.l,hi:ob.h,side:1,time:b.t+width,kind:'OB'});
  }
  if(prev && lo && prev.c>=lo.price && b.c<lo.price) {
    f.bosDown=b.t+width;
    const ob=a.slice(Math.max(0,a.length-6),-1).reverse().find(x=>x.c>x.o);
    if(ob) f.zones.push({lo:ob.l,hi:ob.h,side:-1,time:b.t+width,kind:'OB'});
  }
}
function trend(f: Frame, maxAge: number): 1 | -1 | 0 {
  const now=f.bars.at(-1)?.t ?? 0;
  const highs=f.pivots.filter(p=>p.high).slice(-2), lows=f.pivots.filter(p=>!p.high).slice(-2);
  if(highs.length<2 || lows.length<2) return 0;
  if(highs[1].price>highs[0].price && lows[1].price>lows[0].price && f.bosUp>f.bosDown && now-f.bosUp<=maxAge) return 1;
  if(highs[1].price<highs[0].price && lows[1].price<lows[0].price && f.bosDown>f.bosUp && now-f.bosDown<=maxAge) return -1;
  return 0;
}
const touched=(f:Frame,b:Bar,side:1|-1,now:number) => f.zones.some(z=>z.side===side && z.time<=b.t && now-z.time<=5*24*H && b.l<=z.hi && b.h>=z.lo && (side===1 ? b.c>=z.lo : b.c<=z.hi));

/** Returns close-price signals. Execution simulation should fill at the next available minute open. */
export function analyzeLiquidityStrategies(minutes: Bar[]): Record<1 | 2 | 3, LiquiditySignal[]> {
  const m=minutes.filter(b=>Number.isFinite(b.t)).slice().sort((a,b)=>a.t-b.t);
  const five=aggregate(m,5*MIN), fifteen=aggregate(m,15*MIN), hourly=aggregate(m,H);
  const h=fresh(), q=fresh(), f=fresh(), one=fresh();
  const out:Record<1|2|3,LiquiditySignal[]>={1:[],2:[],3:[]};
  const pending:Record<2|3,Pending[]>={2:[],3:[]};
  let ih=0,iq=0,i5=0,lastHtouch:Record<1|-1,number>={1:-Infinity,[-1]:-Infinity};
  const send=(v:1|2|3,p:Pending,b:Bar,now:number,minR:number)=>{
    const stop=p.extreme-p.side*0.10, risk=p.side*(b.c-stop), reward=p.side*(p.target-b.c);
    if(risk<=0 || reward<=0 || reward/risk<minR) return;
    out[v].push({variant:v,time:now,side:p.side===1?'long':'short',entry:b.c,stop,target:p.target,sweepTime:p.sweepTime}); p.done=true;
  };
  for(const b of m) {
    const now=b.t+MIN;
    while(ih<hourly.length && hourly[ih].t+H<=now) update(h,hourly[ih++],H,5*24*H);
    while(iq<fifteen.length && fifteen[iq].t+15*MIN<=now) {
      const x=fifteen[iq++], xclose=x.t+15*MIN;
      const before=q.pivots.slice();
      const side=trend(h,5*24*H); const qt=trend(q,2*24*H);
      for(const s of [1,-1] as const) if(touched(h,x,s,xclose)) lastHtouch[s]=xclose;
      if(side && side===qt && xclose-lastHtouch[side]<=2*H && touched(q,x,side,xclose)) {
        const sweep=[...before].reverse().find(p=>p.high===(side===-1) && !p.taken && p.time<=x.t && (side===1 ? x.l<p.price && x.c>p.price : x.h>p.price && x.c<p.price));
        const candidates=before.filter(p=>p.high===(side===1) && !p.taken && p.time<=x.t && (side===1 ? p.price>x.h : p.price<x.l)).sort((a,b)=>side*(a.price-b.price));
        if(sweep && candidates.length) {
          const p:Pending={side,sweepTime:xclose,extreme:side===1?x.l:x.h,target:candidates[0].price,level:sweep.price,done:false};
          send(1,p,x,xclose,0);
          pending[2].push({...p,done:false}); pending[3].push({...p,done:false});
        }
      }
      update(q,x,15*MIN,2*24*H);
    }
    while(i5<five.length && five[i5].t+5*MIN<=now) {
      const x=five[i5++]; update(f,x,5*MIN,2*24*H);
      for(const p of pending[2]) if(!p.done && trend(h,5*24*H)===p.side && trend(q,2*24*H)===p.side && x.t>=p.sweepTime && now-p.sweepTime<=60*MIN && (p.side===1 ? x.l>p.extreme && x.h<p.target : x.h<p.extreme && x.l>p.target) && (p.side===1?f.bosUp:f.bosDown)===now) send(2,p,x,now,1);
    }
    update(one,b,MIN,2*H);
    for(const p of pending[3]) if(!p.done && trend(h,5*24*H)===p.side && trend(q,2*24*H)===p.side && b.t>=p.sweepTime && now-p.sweepTime<=60*MIN && (p.side===1 ? b.l>p.extreme && b.h<p.target : b.h<p.extreme && b.l>p.target) && (p.side===1?one.bosUp:one.bosDown)===now) send(3,p,b,now,1.5);
    for(const v of [2,3] as const) pending[v]=pending[v].filter(p=>!p.done && now-p.sweepTime<60*MIN && (b.t<p.sweepTime || (p.side===1?b.l>p.extreme && b.h<p.target:b.h<p.extreme && b.l>p.target)));
  }
  return out;
}





