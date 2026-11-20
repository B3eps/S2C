import { build } from 'esbuild';
const x=await build({entryPoints:['src/lib/liquidityStrategies.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {analyzeLiquidityStrategies: run}=await import('data:text/javascript;base64,'+Buffer.from(x.outputFiles[0].text).toString('base64'));
let seed=342, p=2300; const bars=[];
for(let i=0;i<13000;i++){ seed=(seed*1664525+1013904223)>>>0; const d=(seed/2**32-.5)*3; const o=p;p+=d; bars.push({t:i*60000,o,h:Math.max(o,p)+.4,l:Math.min(o,p)-.4,c:p,v:1}); }
const full=run(bars), prefix=run(bars.slice(0,10000));
for(const v of [1,2,3]) {const a=full[v].filter(s=>s.time<=10000*60000);if(JSON.stringify(a)!==JSON.stringify(prefix[v])) throw Error('lookahead '+v); for(const s of full[v]) if(!(s.side==='long'?s.stop<s.entry&&s.entry<s.target:s.target<s.entry&&s.entry<s.stop)) throw Error('bad levels');}
console.log('Causality and level checks passed:',Object.values(full).map(x=>x.length));
