(function(){
  'use strict';

  const STYLE_ID = 'pp-rain-gauge-style';

  function clamp(v, lo, hi){
    const n = Number(v);
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function lerp(a, b, t){
    return a + ((b - a) * t);
  }

  function lerpColorHex(hexA, hexB, t){
    const a = String(hexA || '').replace('#', '');
    const b = String(hexB || '').replace('#', '');
    if (a.length !== 6 || b.length !== 6) return '#7dd3fc';
    const tt = clamp(t, 0, 1);
    const ar = parseInt(a.slice(0, 2), 16);
    const ag = parseInt(a.slice(2, 4), 16);
    const ab = parseInt(a.slice(4, 6), 16);
    const br = parseInt(b.slice(0, 2), 16);
    const bg = parseInt(b.slice(2, 4), 16);
    const bb = parseInt(b.slice(4, 6), 16);
    const rr = Math.round(lerp(ar, br, tt));
    const rg = Math.round(lerp(ag, bg, tt));
    const rb = Math.round(lerp(ab, bb, tt));
    return `rgb(${rr}, ${rg}, ${rb})`;
  }

  function formatClock(d, lang){
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '--:--';
    return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  function parseDateMaybe(value){
    const s = String(value || '').trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function safeNum(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeRows(rows){
    const list = Array.isArray(rows) ? rows : [];
    return list
      .map((row)=> {
        const dt = row?.dt instanceof Date ? row.dt : parseDateMaybe(row?.datetime || row?.time || row?.date);
        const precipAmount = safeNum(row?.precipAmount ?? row?.precipitation ?? row?.rain ?? row?.precipitation_amount);
        const precipProb = safeNum(row?.precipProb ?? row?.precipitation_probability ?? row?.rain_probability);
        return { dt, precipAmount, precipProb };
      })
      .filter((row)=> row.dt instanceof Date && !Number.isNaN(row.dt.getTime()))
      .sort((a, b)=> a.dt - b.dt);
  }

  function pointValue(row){
    const mmh = Number.isFinite(row?.precipAmount) ? Math.max(0, row.precipAmount) : 0;
    const p = Number.isFinite(row?.precipProb) ? clamp(row.precipProb / 100, 0, 1) : 1;
    return mmh * p;
  }

  function interpolateMmh(points, tMs){
    if (!Array.isArray(points) || !points.length) return 0;
    if (points.length === 1) return pointValue(points[0]);
    const first = points[0];
    const last = points[points.length - 1];
    if (tMs <= first.dt.getTime()) return pointValue(first);
    if (tMs >= last.dt.getTime()) return pointValue(last);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const next = points[i];
      const a = prev.dt.getTime();
      const b = next.dt.getTime();
      if (tMs < a || tMs > b) continue;
      const ratio = (tMs - a) / Math.max(1, (b - a));
      return lerp(pointValue(prev), pointValue(next), ratio);
    }
    return 0;
  }

  function buildMinuteSeries(rows, now){
    const points = normalizeRows(rows);
    const start = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    const out = [];
    for (let i = 0; i < 60; i++) {
      const at = new Date(start.getTime() + (i * 60000));
      const mmh = Math.max(0, interpolateMmh(points, at.getTime()));
      out.push({ at, mmh });
    }
    return out;
  }

  function ensureStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.pp-rain-gauge-card{
  margin: 0;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,.14);
  background: var(--pp-rain-gauge-bg, linear-gradient(135deg, rgba(12,22,38,.95), rgba(24,34,50,.92)));
  color: #ecfeff;
  box-shadow: 0 8px 20px rgba(15,23,42,.22);
  padding: 12px 14px 10px;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}
.pp-rain-gauge-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:6px;
}
.pp-rain-gauge-title{
  font-weight:800;
  font-size:1.02rem;
  letter-spacing:.01em;
}
.pp-rain-gauge-time{
  font-size:.9rem;
  opacity:.86;
}
.pp-rain-gauge-time-pointer{
  font-size:10px;
  fill:#fecaca;
  font-weight:700;
}
.pp-rain-gauge-wrap{
  position:relative;
  height:100%;
  width:auto;
  max-width:min(100%, 420px);
  margin:0 auto;
  aspect-ratio:1 / 1;
  min-height:0;
  align-self:center;
  justify-self:center;
}
.pp-rain-gauge-svg{
  width:100%;
  height:100%;
  display:block;
}
.pp-rain-gauge-center{
  position:absolute;
  inset:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  pointer-events:none;
}
.pp-rain-gauge-value{
  font-size:2rem;
  font-weight:900;
  line-height:1;
}
.pp-rain-gauge-unit{
  font-size:.95rem;
  opacity:.85;
}
.pp-rain-gauge-msg{
  margin-top:8px;
  font-size:clamp(.78rem, 1.3vw, .96rem);
  font-weight:700;
  max-width:78%;
  line-height:1.25;
  white-space:normal;
  overflow-wrap:anywhere;
}
.pp-rain-gauge-legend{
  margin-top:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  flex-wrap:wrap;
  font-size:.8rem;
  opacity:.85;
  row-gap:6px;
}
.pp-rain-gauge-dot{
  width:10px;
  height:10px;
  border-radius:999px;
  display:inline-block;
}
.pp-rain-gauge-card.pp-rain-mode-popup{
  margin: 4px 0 14px;
  min-height: 260px;
  height: auto;
}
.pp-rain-gauge-card.pp-rain-compact{
  padding: 9px 10px 8px;
}
.pp-rain-gauge-card.pp-rain-compact .pp-rain-gauge-head{
  margin-bottom: 4px;
}
.pp-rain-gauge-card.pp-rain-compact .pp-rain-gauge-title{
  font-size:.93rem;
}
.pp-rain-gauge-card.pp-rain-compact .pp-rain-gauge-time{
  font-size:.8rem;
}
.pp-rain-gauge-card.pp-rain-compact .pp-rain-gauge-value{
  font-size:1.58rem;
}
.pp-rain-gauge-card.pp-rain-compact .pp-rain-gauge-msg{
  margin-top:5px;
  font-size:.74rem;
  max-width:84%;
}
.pp-rain-gauge-card.pp-rain-compact .pp-rain-gauge-legend{
  display:none;
}
`;
    document.head.appendChild(style);
  }

  function colorForNorm(v){
    const n = clamp(v, 0, 1);
    if (n <= 0.0001) return 'rgba(203,213,225,0.12)';
    if (n < 0.35) return lerpColorHex('#7dd3fc', '#38bdf8', n / 0.35);
    if (n < 0.65) return lerpColorHex('#38bdf8', '#1d4ed8', (n - 0.35) / 0.3);
    if (n < 0.85) return lerpColorHex('#1d4ed8', '#ef4444', (n - 0.65) / 0.2);
    return lerpColorHex('#ef4444', '#7e22ce', (n - 0.85) / 0.15);
  }

  function textPack(lang){
    if (lang === 'de') {
      return {
        title: 'Regenvorhersage 60 Minuten',
        dry: 'Kein Regen in 60 Min.',
        wetFor: (m)=> `Regen in ~${m} Min.`,
        zero: '0 mm',
        low: 'leicht',
        mid: 'mittel',
        high: 'stark',
        extreme: 'extrem'
      };
    }
    return {
      title: 'Rain forecast 60 minutes',
      dry: 'No rain in 60 min.',
      wetFor: (m)=> `Rain for ~${m} min.`,
      zero: '0 mm',
      low: 'light',
      mid: 'medium',
      high: 'heavy',
      extreme: 'extreme'
    };
  }

  function getDayPhase(now){
    const h = Number(now?.getHours?.() || 0);
    const m = Number(now?.getMinutes?.() || 0);
    const hm = (h * 60) + m;
    if (hm >= 300 && hm < 420) return 'dawn';   // 05:00-06:59
    if (hm >= 420 && hm < 1080) return 'day';   // 07:00-17:59
    if (hm >= 1080 && hm < 1200) return 'dusk'; // 18:00-19:59
    return 'night';                              // 20:00-04:59
  }

  function backgroundForPhase(phase){
    if (phase === 'dawn') {
      return 'linear-gradient(140deg, rgba(46,64,94,.95), rgba(245,158,11,.52), rgba(251,191,36,.32))';
    }
    if (phase === 'day') {
      return 'linear-gradient(140deg, rgba(14,116,144,.92), rgba(59,130,246,.75), rgba(125,211,252,.52))';
    }
    if (phase === 'dusk') {
      return 'linear-gradient(140deg, rgba(88,28,135,.93), rgba(239,68,68,.62), rgba(251,146,60,.42))';
    }
    return 'linear-gradient(140deg, rgba(8,15,29,.96), rgba(26,42,72,.9), rgba(30,64,175,.42))';
  }

  function minuteHandAngle(now){
    const min = Number(now?.getMinutes?.() || 0);
    const sec = Number(now?.getSeconds?.() || 0);
    const frac = (min + (sec / 60)) / 60;
    return -90 + (frac * 360);
  }

  function polarPoint(cx, cy, r, deg){
    const a = deg * (Math.PI / 180);
    return {
      x: cx + (Math.cos(a) * r),
      y: cy + (Math.sin(a) * r)
    };
  }

  function minuteAxisPoint(cx, cy, r, minute){
    const m = ((Number(minute) % 60) + 60) % 60;
    if (m === 0) return { x: cx, y: cy - r };
    if (m === 15) return { x: cx + r, y: cy };
    if (m === 30) return { x: cx, y: cy + r };
    if (m === 45) return { x: cx - r, y: cy };
    return polarPoint(cx, cy, r, -90 + (m * 6));
  }

  function renderFromForecastRows(rows, options){
    ensureStyle();
    const opts = options || {};
    const lang = opts.lang === 'de' ? 'de' : 'en';
    const txt = textPack(lang);
    const now = opts.now instanceof Date ? opts.now : new Date();
    const mode = String(opts.mode || 'dashboard').toLowerCase();
    const compact = !!opts.compact;
    const phase = getDayPhase(now);
    const bg = backgroundForPhase(phase);
    const series = buildMinuteSeries(rows, now);
    const maxMmh = Math.max(0.8, ...series.map((x)=> x.mmh));
    const wetMinutes = series.filter((x)=> x.mmh >= 0.08).length;
    const currentMmh = series.length ? series[0].mmh : 0;

    const cx = 210;
    const cy = 210;
    const rInner = 126;
    const baseTick = 4.2;
    const extraBar = 26;
    const handAngle = minuteHandAngle(now);
    const baseTicks = series.map((_, idx)=>{
      const angle = handAngle + (idx * 6);
      return `
<g transform="translate(${cx} ${cy}) rotate(${angle})">
  <rect x="-1.4" y="-${(rInner + baseTick).toFixed(1)}" width="2.8" height="${baseTick.toFixed(1)}" rx="1.2" fill="rgba(203,213,225,0.25)"></rect>
</g>`;
    }).join('');
    const bars = series.map((step, idx)=>{
      const angle = handAngle + (idx * 6);
      const norm = clamp(step.mmh / maxMmh, 0, 1);
      const len = extraBar * norm;
      if (len < 0.8) return '';
      const color = colorForNorm(norm);
      const alpha = 0.18 + (0.78 * norm);
      return `
<g transform="translate(${cx} ${cy}) rotate(${angle})">
  <rect x="-2.2" y="-${(rInner + baseTick + len).toFixed(1)}" width="4.4" height="${len.toFixed(1)}" rx="1.8" fill="${color}" fill-opacity="${alpha.toFixed(3)}"></rect>
</g>`;
    }).join('');

    const outerMinuteMarks = Array.from({ length: 12 }).map((_, i)=>{
      const m = i * 5;
      const quarter = (m % 15 === 0);
      const p1 = minuteAxisPoint(cx, cy, quarter ? 154 : 157, m);
      const p2 = minuteAxisPoint(cx, cy, 166, m);
      return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="rgba(226,232,240,.45)" stroke-width="${quarter ? '1.6' : '1.05'}" stroke-linecap="round"></line>`;
    }).join('');

    const minuteLabels = Array.from({ length: 12 }).map((_, i)=>{
      const m = i * 5;
      const label = m === 0 ? '60' : String(m);
      const p = minuteAxisPoint(cx, cy, 178, m);
      const x = p.x;
      const y = p.y;
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="rgba(236,254,255,.66)" font-size="10">${label}</text>`;
    }).join('');
    const handStart = polarPoint(cx, cy, rInner - 2, handAngle);
    const handEnd = polarPoint(cx, cy, rInner + extraBar - 2, handAngle);
    const handTimePos = polarPoint(cx, cy, rInner + extraBar + 10, handAngle + 2);
    const pointerTimeText = formatClock(now, lang);

    const msg = wetMinutes > 0 ? txt.wetFor(wetMinutes) : txt.dry;

    return `
<section class="pp-rain-gauge-card pp-rain-mode-${mode}${compact ? ' pp-rain-compact' : ''}" style="--pp-rain-gauge-bg:${bg}">
  <div class="pp-rain-gauge-head">
    <div class="pp-rain-gauge-title">${txt.title}</div>
    <div class="pp-rain-gauge-time">${formatClock(now, lang)}</div>
  </div>
  <div class="pp-rain-gauge-wrap">
    <svg class="pp-rain-gauge-svg" viewBox="0 0 420 420" role="img" aria-label="${txt.title}">
      ${outerMinuteMarks}
      ${minuteLabels}
      ${baseTicks}
      ${bars}
      <line x1="${handStart.x.toFixed(1)}" y1="${handStart.y.toFixed(1)}" x2="${handEnd.x.toFixed(1)}" y2="${handEnd.y.toFixed(1)}" stroke="#ef4444" stroke-width="1.9" stroke-linecap="round"></line>
      <text x="${handTimePos.x.toFixed(1)}" y="${handTimePos.y.toFixed(1)}" class="pp-rain-gauge-time-pointer" text-anchor="middle" dominant-baseline="middle">${pointerTimeText}</text>
      <circle cx="${cx}" cy="${cy}" r="106" fill="none" stroke="rgba(226,232,240,.14)" stroke-width="1"></circle>
    </svg>
    <div class="pp-rain-gauge-center">
      <div class="pp-rain-gauge-value">${currentMmh.toFixed(1)}</div>
      <div class="pp-rain-gauge-unit">mm/h</div>
      <div class="pp-rain-gauge-msg">${msg}</div>
    </div>
  </div>
  <div class="pp-rain-gauge-legend">
    <span class="pp-rain-gauge-dot" style="background:rgba(203,213,225,.45)"></span><span>${txt.zero}</span>
    <span class="pp-rain-gauge-dot" style="background:#38bdf8"></span><span>${txt.low}</span>
    <span class="pp-rain-gauge-dot" style="background:#1d4ed8"></span><span>${txt.mid}</span>
    <span class="pp-rain-gauge-dot" style="background:#ef4444"></span><span>${txt.high}</span>
    <span class="pp-rain-gauge-dot" style="background:#7e22ce"></span><span>${txt.extreme}</span>
  </div>
</section>`;
  }

  window.PPRainGaugeIntegration = {
    renderFromForecastRows
  };
})();
