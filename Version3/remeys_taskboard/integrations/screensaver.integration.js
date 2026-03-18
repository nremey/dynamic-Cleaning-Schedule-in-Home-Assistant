(function(){
  'use strict';

  function pad2(v){ return String(v).padStart(2, '0'); }

  function weekNumber(dt){
    const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function monthLabel(dt, lang){
    return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { month:'long', year:'numeric' }).format(dt);
  }

  function formatDateTimeLine(dt, lang){
    const locale = lang === 'de' ? 'de-DE' : 'en-US';
    const d = new Intl.DateTimeFormat(locale, { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' }).format(dt);
    const t = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`;
    return { date: d, time: t };
  }

  function toIsoDay(dt){
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }

  async function fetchImageList(basePath, getHaOrigin){
    const manifestUrl = new URL(basePath + 'screensaver/backgrounds.json', getHaOrigin()).toString();
    try {
      const res = await fetch(manifestUrl, { cache:'no-store' });
      if (!res.ok) throw new Error('no backgrounds.json');
      const data = await res.json();
      if (Array.isArray(data)) return data.map(String).map(s => s.trim()).filter(Boolean);
      if (Array.isArray(data?.images)) return data.images.map(String).map(s => s.trim()).filter(Boolean);
    } catch (_) {}
    return [];
  }

  function pickBackground(basePath, images){
    if (Array.isArray(images) && images.length) {
      const idx = Math.floor(Math.random() * images.length);
      const file = String(images[idx] || '').trim();
      if (file) return basePath + 'screensaver/' + file.replace(/^\/+/, '');
    }
    return basePath + 'screensaver/background.jpg';
  }

  async function fetchCalendarEvents(hass, sources, startDate, endDate){
    if (!hass?.callApi) return [];
    const out = [];
    const startIso = `${toIsoDay(startDate)}T00:00:00`;
    const endIso = `${toIsoDay(endDate)}T23:59:59`;

    for (const src of (Array.isArray(sources) ? sources : [])) {
      const entityId = String(src?.entityId || '').trim();
      if (!entityId) continue;
      try {
        const path = `calendars/${encodeURIComponent(entityId)}?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
        const rows = await hass.callApi('GET', path);
        if (!Array.isArray(rows)) continue;
        rows.forEach((ev)=>{
          const title = String(ev?.summary || ev?.message || src?.name || entityId || '').trim();
          if (!title) return;
          const startRaw = String(ev?.start?.dateTime || ev?.start?.date || '').trim();
          const endRaw = String(ev?.end?.dateTime || ev?.end?.date || '').trim();
          out.push({
            title,
            startRaw,
            endRaw,
            sourceName: String(src?.name || entityId || '').trim(),
            color: String(src?.color || '').trim()
          });
        });
      } catch (_) {}
    }

    out.sort((a,b)=> String(a.startRaw || '').localeCompare(String(b.startRaw || '')));
    return out;
  }

  function formatEventTime(raw, lang){
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return lang === 'de' ? 'Ganztägig' : 'All day';
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return '';
    return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  }

  function weatherBlock(hass, weatherCfg){
    const cfg = weatherCfg && typeof weatherCfg === 'object' ? weatherCfg : {};
    const entityId = String(cfg.entityId || '').trim().toLowerCase();
    if (!entityId || !cfg.enabled) return { icon:'mdi:weather-cloudy', temp:'--', state:'--' };
    const st = hass?.states?.[entityId];
    if (!st) return { icon:'mdi:weather-cloudy-alert', temp:'--', state:'--' };
    const attrs = st.attributes || {};
    const temp = Number(attrs.temperature);
    const tempTxt = Number.isFinite(temp) ? `${Math.round(temp)}°${String(attrs.temperature_unit || 'C').toUpperCase()}` : '--';
    return {
      icon: 'mdi:weather-partly-cloudy',
      temp: tempTxt,
      state: String(st.state || '--')
    };
  }

  function createController(options){
    const opts = options || {};
    const t = (k)=> {
      try { return typeof opts.t === 'function' ? String(opts.t(k) || k) : k; }
      catch (_) { return k; }
    };

    const root = opts.root;
    const dlg = opts.dialog;
    let tickTimer = null;
    let refreshTimer = null;
    let imageList = null;

    function getLang(){
      return (typeof opts.getLang === 'function' ? opts.getLang() : 'de') === 'en' ? 'en' : 'de';
    }

    function getBasePath(){
      const b = typeof opts.getBasePath === 'function' ? opts.getBasePath() : '/local/';
      return String(b || '/local/').replace(/\/+$/, '/') ;
    }

    function getHaOrigin(){
      if (typeof opts.getHaOrigin === 'function') return opts.getHaOrigin();
      return window.location.origin;
    }

    function stop(){
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    }

    async function render(){
      if (!root) return;
      const lang = getLang();
      const now = new Date();
      const calWeek = weekNumber(now);
      const month = monthLabel(now, lang);
      const dt = formatDateTimeLine(now, lang);
      const hass = typeof opts.getHass === 'function' ? opts.getHass() : null;
      const weatherCfg = typeof opts.getWeatherSettings === 'function' ? opts.getWeatherSettings() : {};
      const weather = weatherBlock(hass, weatherCfg);
      const sources = typeof opts.getCalendarSources === 'function' ? opts.getCalendarSources() : [];
      const end = new Date(now);
      end.setDate(end.getDate() + 6);
      const events = await fetchCalendarEvents(hass, sources, now, end);

      if (!imageList) imageList = await fetchImageList(getBasePath(), getHaOrigin);
      const bgUrl = pickBackground(getBasePath(), imageList);

      const eventRows = events.slice(0, 14).map((ev)=>{
        const s = formatEventTime(ev.startRaw, lang);
        const e = formatEventTime(ev.endRaw, lang);
        const time = s && e ? `${s} - ${e}` : (s || e || '');
        const colorStyle = ev.color ? ` style="--pp-sc-accent:${String(ev.color).replaceAll('"', '')}"` : '';
        return `<li class="pp-sc-event"${colorStyle}><span class="pp-sc-event-time">${time}</span><span class="pp-sc-event-title">${ev.title}</span></li>`;
      }).join('');

      root.style.backgroundImage = `linear-gradient(120deg, rgba(6,16,28,.62), rgba(6,16,28,.34)), url('${bgUrl}')`;
      root.innerHTML = `
        <div class="pp-sc-overlay">
          <div class="pp-sc-top">
            <div class="pp-sc-clock">${dt.time}</div>
            <div class="pp-sc-date">${dt.date}</div>
          </div>
          <div class="pp-sc-meta">
            <div class="pp-sc-pill">${t('weekNumberBadgePrefix')} ${calWeek}</div>
            <div class="pp-sc-pill">${month}</div>
            <div class="pp-sc-pill"><iconify-icon icon="${weather.icon}"></iconify-icon> ${weather.temp} · ${weather.state}</div>
          </div>
          <div class="pp-sc-events-wrap">
            <h4>${t('settingsGroupCalendars')}</h4>
            <ul class="pp-sc-events">${eventRows || `<li class="pp-sc-empty">${t('familyNoEvents')}</li>`}</ul>
          </div>
        </div>
      `;
    }

    async function open(){
      if (!dlg || !root) return;
      await render();
      dlg.showModal();
      stop();
      tickTimer = setInterval(()=>{ render().catch(()=>{}); }, 1000);
      refreshTimer = setInterval(()=>{ imageList = null; render().catch(()=>{}); }, 5 * 60 * 1000);
    }

    function close(){
      stop();
      try { dlg?.close(); } catch (_) {}
    }

    return { open, close, render };
  }

  window.PPScreensaverIntegration = {
    createController
  };
})();
