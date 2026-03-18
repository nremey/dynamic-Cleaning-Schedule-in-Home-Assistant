(function(){
  'use strict';

  function normalizeGlobalToggle(v){
    if (v === true || v === 1) return true;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled';
  }

  function normalizeWeatherSettings(raw){
    const cfg = (raw && typeof raw === 'object') ? raw : {};
    const enabled = normalizeGlobalToggle(cfg.enabled);
    const entityId = String(cfg.entityId || cfg.entity_id || '').trim().toLowerCase();
    const astroEntityId = String(cfg.astroEntityId || cfg.astro_entity_id || '').trim().toLowerCase();
    const moonPhaseEntityId = String(cfg.moonPhaseEntityId || cfg.moon_phase_entity_id || '').trim().toLowerCase();
    let iconSize = Number(cfg.iconSize);
    if (!Number.isFinite(iconSize)) iconSize = 20;
    iconSize = Math.max(14, Math.min(64, Math.round(iconSize)));
    const tempUnitRaw = String(cfg.tempUnit || cfg.temperatureUnit || 'auto').trim().toLowerCase();
    const tempUnit = (tempUnitRaw === 'c' || tempUnitRaw === 'f') ? tempUnitRaw : 'auto';
    let forecastDays = Number(cfg.forecastDays);
    if (!Number.isFinite(forecastDays)) forecastDays = 7;
    forecastDays = Math.max(1, Math.min(10, Math.round(forecastDays)));
    return {
      enabled,
      entityId,
      astroEntityId,
      moonPhaseEntityId,
      iconSize,
      tempUnit,
      forecastDays,
      showTemperature: cfg.showTemperature === undefined ? true : normalizeGlobalToggle(cfg.showTemperature),
      showHumidity: normalizeGlobalToggle(cfg.showHumidity),
      showPrecipProbability: cfg.showPrecipProbability === undefined ? true : normalizeGlobalToggle(cfg.showPrecipProbability),
      showPrecipAmount: normalizeGlobalToggle(cfg.showPrecipAmount),
      showSunrise: normalizeGlobalToggle(cfg.showSunrise),
      showSunset: normalizeGlobalToggle(cfg.showSunset),
      showMoonPhase: normalizeGlobalToggle(cfg.showMoonPhase),
      showWindDirection: normalizeGlobalToggle(cfg.showWindDirection),
      showWindSpeed: normalizeGlobalToggle(cfg.showWindSpeed),
      showPollen: normalizeGlobalToggle(cfg.showPollen)
    };
  }

  function canonicalWeatherState(state){
    return String(state || '').trim().toLowerCase().replace(/[_\-\s]+/g, '');
  }

  function weatherIconForState(state, options){
    const raw = String(state || '').trim().toLowerCase();
    const s = canonicalWeatherState(raw);
    const isNight = !!(options && options.isNight);
    if (isNight) {
      const nightMap = {
        sunny:'mdi:weather-night',
        clear:'mdi:weather-night',
        partlycloudy:'mdi:weather-night-partly-cloudy',
        cloudy:'mdi:weather-night-partly-cloudy',
        rainy:'mdi:weather-night-rainy',
        pouring:'mdi:weather-pouring',
        fog:'mdi:weather-fog',
        lightning:'mdi:weather-lightning',
        lightningrainy:'mdi:weather-lightning-rainy',
        snowy:'mdi:weather-snowy',
        snowyrainy:'mdi:weather-snowy-rainy',
        windy:'mdi:weather-windy',
        windyvariant:'mdi:weather-windy-variant',
        hail:'mdi:weather-hail',
        exceptional:'mdi:alert-circle-outline',
        clearnight:'mdi:weather-night'
      };
      if (nightMap[s]) return nightMap[s];
    }
    const map = {
      clearnight:'mdi:weather-night',
      cloudy:'mdi:weather-cloudy',
      exceptional:'mdi:alert-circle-outline',
      fog:'mdi:weather-fog',
      hail:'mdi:weather-hail',
      lightning:'mdi:weather-lightning',
      lightningrainy:'mdi:weather-lightning-rainy',
      partlycloudy:'mdi:weather-partly-cloudy',
      pouring:'mdi:weather-pouring',
      rainy:'mdi:weather-rainy',
      snowy:'mdi:weather-snowy',
      snowyrainy:'mdi:weather-snowy-rainy',
      sunny:'mdi:weather-sunny',
      clear:'mdi:weather-sunny',
      windy:'mdi:weather-windy',
      windyvariant:'mdi:weather-windy-variant'
    };
    return map[s] || map[canonicalWeatherState(raw)] || 'mdi:weather-partly-cloudy';
  }

  function normalizeMoonPhaseValue(phase){
    const p = String(phase || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    const known = new Set([
      'new_moon',
      'waxing_crescent',
      'first_quarter',
      'waxing_gibbous',
      'full_moon',
      'waning_gibbous',
      'last_quarter',
      'waning_crescent'
    ]);
    if (known.has(p)) return p;
    if (p.includes('new')) return 'new_moon';
    if (p.includes('waxing') && p.includes('crescent')) return 'waxing_crescent';
    if (p.includes('first')) return 'first_quarter';
    if (p.includes('waxing') && p.includes('gibbous')) return 'waxing_gibbous';
    if (p.includes('full')) return 'full_moon';
    if (p.includes('waning') && p.includes('gibbous')) return 'waning_gibbous';
    if (p.includes('last') || p.includes('third')) return 'last_quarter';
    if (p.includes('waning') && p.includes('crescent')) return 'waning_crescent';
    return '';
  }

  function moonPhaseSymbol(phase){
    const key = normalizeMoonPhaseValue(phase);
    const map = {
      new_moon: '🌑',
      waxing_crescent: '🌒',
      first_quarter: '🌓',
      waxing_gibbous: '🌔',
      full_moon: '🌕',
      waning_gibbous: '🌖',
      last_quarter: '🌗',
      waning_crescent: '🌘'
    };
    return map[key] || '○';
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  function formatTempValue(raw, fromUnit, tempUnitPref){
    const value = convertTempNumeric(raw, fromUnit, tempUnitPref);
    if (!Number.isFinite(value)) return '--';
    const outUnit = resolveTempUnit(fromUnit, tempUnitPref);
    return `${Math.round(value)}°${outUnit}`;
  }

  function setHeaderTempParts(valueEl, unitEl, tempText){
    const raw = String(tempText || '').trim();
    const m = /^(-?\d+(?:[.,]\d+)?)\s*°\s*([CF])$/i.exec(raw);
    if (m) {
      valueEl.textContent = m[1];
      unitEl.textContent = `°${String(m[2]).toUpperCase()}`;
      return;
    }
    valueEl.textContent = '--';
    unitEl.textContent = '°C';
  }

  function resolveTempUnit(fromUnit, tempUnitPref){
    const source = String(fromUnit || '').trim().toUpperCase();
    const pref = String(tempUnitPref || 'auto').toLowerCase();
    if (pref === 'c') return 'C';
    if (pref === 'f') return 'F';
    return source === 'F' ? 'F' : 'C';
  }

  function convertTempNumeric(raw, fromUnit, tempUnitPref){
    let value = Number(raw);
    if (!Number.isFinite(value)) return null;
    const source = String(fromUnit || '').trim().toUpperCase();
    const target = resolveTempUnit(fromUnit, tempUnitPref);
    if (source === 'F' && target === 'C') value = (value - 32) * (5 / 9);
    if (source !== 'F' && target === 'F') value = (value * (9 / 5)) + 32;
    return value;
  }

  function parseDateMaybe(value){
    const s = String(value || '').trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function buildSunContext(attrs){
    const a = (attrs && typeof attrs === 'object') ? attrs : {};
    return {
      nextRising: parseDateMaybe(a.next_rising),
      nextSetting: parseDateMaybe(a.next_setting),
      nextNoon: parseDateMaybe(a.next_noon),
      nextMidnight: parseDateMaybe(a.next_midnight),
      nextDawn: parseDateMaybe(a.next_dawn),
      nextDusk: parseDateMaybe(a.next_dusk)
    };
  }

  function shiftEventToDay(baseEvent, targetDt){
    if (!(baseEvent instanceof Date) || Number.isNaN(baseEvent.getTime())) return null;
    if (!(targetDt instanceof Date) || Number.isNaN(targetDt.getTime())) return null;
    const out = new Date(baseEvent);
    const d = diffDays(targetDt, baseEvent);
    out.setDate(out.getDate() + d);
    return out;
  }

  function sunRiseSetForDate(targetDt, row, sunCtx){
    const riseRow = parseDateMaybe(row?.sunrise);
    const setRow = parseDateMaybe(row?.sunset);
    if (riseRow && setRow) return { rise: riseRow, set: setRow };
    if (!sunCtx) return { rise: riseRow, set: setRow };
    const rise = riseRow || shiftEventToDay(sunCtx.nextRising, targetDt);
    const set = setRow || shiftEventToDay(sunCtx.nextSetting, targetDt);
    return { rise, set };
  }

  function isNightAt(dt, row, sunCtx){
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return false;
    const rs = sunRiseSetForDate(dt, row, sunCtx);
    if (rs.rise && rs.set) return !(dt >= rs.rise && dt <= rs.set);
    if (Number.isFinite(row?.sunElevation)) return Number(row.sunElevation) < 0;
    const h = dt.getHours();
    return h < 6 || h >= 20;
  }

  function normalizeCondition(value){
    return String(value || '').trim();
  }

  function formatConditionLabel(value){
    const raw = String(value || '').trim();
    if (!raw) return '—';
    return raw
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .replace(/\s+/g, ' ')
      .replace(/^./, (m)=> m.toUpperCase());
  }

  function windBearingDeg(raw){
    const n = Number(raw);
    if (Number.isFinite(n)) {
      let out = n % 360;
      if (out < 0) out += 360;
      return out;
    }
    const s = String(raw || '').trim().toUpperCase();
    const map = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
      E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
      W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
      NO: 45, ONO: 67.5, O: 90, OSO: 112.5,
      SO: 135, SSO: 157.5, SSW_DE: 202.5,
      SW_DE: 225, WSW_DE: 247.5, WNW_DE: 292.5,
      NW_DE: 315, NNW_DE: 337.5
    };
    if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
    return null;
  }

  function windCategoryClass(speedKmh){
    const v = Number(speedKmh);
    if (!Number.isFinite(v) || v < 1) return 'weather-chart-wind-calm';
    if (v < 12) return 'weather-chart-wind-breeze';
    if (v < 29) return 'weather-chart-wind-fresh';
    if (v < 50) return 'weather-chart-wind-strong';
    if (v < 75) return 'weather-chart-wind-storm';
    if (v < 103) return 'weather-chart-wind-severe';
    if (v < 118) return 'weather-chart-wind-hurricane';
    return 'weather-chart-wind-orkan';
  }

  function pickFirstFinite(list){
    for (const v of list) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function pickFirstText(list){
    for (const v of list) {
      const s = String(v || '').trim();
      if (s) return s;
    }
    return '';
  }

  function normalizeForecastRow(row){
    const dt = parseDateMaybe(row?.datetime || row?.time || row?.date || row?.timestamp || row?.dt);
    const temp = pickFirstFinite([row?.temperature, row?.temperature_max, row?.max_temperature, row?.temp]);
    const feelsLike = pickFirstFinite([row?.apparent_temperature, row?.feels_like_temperature, row?.feels_like, row?.temperature_apparent]);
    const low = pickFirstFinite([row?.templow, row?.temperature_low, row?.temperature_min, row?.min_temperature]);
    const precipProb = pickFirstFinite([row?.precipitation_probability, row?.rain_probability, row?.precip_probability]);
    const precipAmount = pickFirstFinite([row?.precipitation, row?.precipitation_amount, row?.rain, row?.rain_amount]);
    const humidity = pickFirstFinite([row?.humidity, row?.relative_humidity]);
    const windSpeed = pickFirstFinite([row?.wind_speed, row?.windspeed, row?.windSpeed]);
    const windGust = pickFirstFinite([row?.wind_gust_speed, row?.wind_gust, row?.gust_speed]);
    const uv = pickFirstFinite([row?.uv_index, row?.uv, row?.uvi]);
    const windDir = pickFirstText([row?.wind_bearing, row?.wind_direction, row?.winddir]);
    const sunrise = pickFirstText([row?.sunrise, row?.sunrise_time, row?.sunrise_datetime]);
    const sunset = pickFirstText([row?.sunset, row?.sunset_time, row?.sunset_datetime]);
    const moon = pickFirstText([row?.moon_phase, row?.moonphase]);
    const moonrise = pickFirstText([row?.moonrise, row?.moonrise_time, row?.moonrise_datetime]);
    const moonset = pickFirstText([row?.moonset, row?.moonset_time, row?.moonset_datetime]);
    const sunElevation = pickFirstFinite([row?.sun_elevation, row?.solar_elevation]);
    const moonElevation = pickFirstFinite([row?.moon_elevation]);
    const pollen = pickFirstText([row?.pollen, row?.pollen_level, row?.pollen_index]);
    return {
      raw: row,
      dt,
      condition: normalizeCondition(row?.condition || row?.state || row?.weather),
      temp,
      feelsLike,
      low,
      precipProb,
      precipAmount,
      humidity,
      windSpeed,
      windGust,
      uv,
      windDir,
      sunrise,
      sunset,
      moon,
      moonrise,
      moonset,
      sunElevation,
      moonElevation,
      pollen
    };
  }

  function dayKeyFromDate(d){
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function startOfDay(d){
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseDayKeyLocal(value){
    const s = String(value || '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const out = new Date(y, mo - 1, d, 0, 0, 0, 0);
    if (Number.isNaN(out.getTime())) return null;
    return out;
  }

  function diffDays(a, b){
    const aa = startOfDay(a);
    const bb = startOfDay(b);
    if (!aa || !bb) return 0;
    return Math.round((aa - bb) / 86400000);
  }

  function clamp01(v){
    return Math.max(0, Math.min(1, Number(v) || 0));
  }

  function meanAndStd(values){
    const nums = values.filter(Number.isFinite);
    if (!nums.length) return { mean: 0, std: 0 };
    const mean = nums.reduce((a,b)=> a + b, 0) / nums.length;
    const variance = nums.reduce((a,b)=> a + ((b - mean) * (b - mean)), 0) / nums.length;
    return { mean, std: Math.sqrt(Math.max(0, variance)) };
  }

  function buildConditionalPath(rows, values, xForTime, yForValue, predicate){
    if (!Array.isArray(rows) || !rows.length || !Array.isArray(values) || values.length !== rows.length) return '';
    const parts = [];
    let drawing = false;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const v = values[i];
      const ok = predicate(v);
      if (!ok || !(r?.dt instanceof Date) || Number.isNaN(r.dt.getTime())) {
        drawing = false;
        continue;
      }
      const x = xForTime(r.dt);
      const y = yForValue(v);
      parts.push(`${drawing ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`);
      drawing = true;
    }
    return parts.join(' ');
  }

  function lerpColorHex(hexA, hexB, t){
    const a = String(hexA || '').replace('#','');
    const b = String(hexB || '').replace('#','');
    if (a.length !== 6 || b.length !== 6) return '#000000';
    const tt = clamp01(t);
    const ar = parseInt(a.slice(0,2), 16);
    const ag = parseInt(a.slice(2,4), 16);
    const ab = parseInt(a.slice(4,6), 16);
    const br = parseInt(b.slice(0,2), 16);
    const bg = parseInt(b.slice(2,4), 16);
    const bb = parseInt(b.slice(4,6), 16);
    const rr = Math.round(ar + ((br - ar) * tt));
    const rg = Math.round(ag + ((bg - ag) * tt));
    const rb = Math.round(ab + ((bb - ab) * tt));
    return `rgb(${rr}, ${rg}, ${rb})`;
  }

  function warningLevelFromRow(row){
    const c = String(row?.condition || '').toLowerCase();
    const wind = Number(row?.windSpeed);
    const gust = Number(row?.windGust);
    const temp = Number(row?.temp);
    if (c.includes('lightning') || c.includes('thunder')) return 3;
    if (c.includes('fog')) return 2;
    if (c.includes('snowy-rainy') || c.includes('hail') || (Number.isFinite(temp) && temp <= 1 && Number(row?.precipAmount) > 0)) return 2;
    if ((Number.isFinite(wind) && wind >= 45) || (Number.isFinite(gust) && gust >= 60) || c.includes('windy-variant') || c.includes('storm')) return 2;
    return 0;
  }

  function moonPhaseSeed(phase){
    const p = String(phase || '').toLowerCase();
    if (p.includes('new')) return 0;
    if (p.includes('waxing')) return 0.2;
    if (p.includes('first')) return 0.25;
    if (p.includes('full')) return 0.5;
    if (p.includes('waning')) return 0.7;
    if (p.includes('last')) return 0.75;
    return 0.35;
  }

  function resolveCurrentMoonPhase(hass, cfg, hourlyRows, dailyRows){
    const sensorId = String(cfg?.moonPhaseEntityId || '').trim().toLowerCase();
    if (sensorId && hass?.states?.[sensorId]) {
      const st = hass.states[sensorId];
      const fromState = normalizeMoonPhaseValue(st?.state);
      if (fromState) return fromState;
      const fromAttr = normalizeMoonPhaseValue(st?.attributes?.moon_phase);
      if (fromAttr) return fromAttr;
    }
    const rows = Array.isArray(hourlyRows) && hourlyRows.length ? hourlyRows : (Array.isArray(dailyRows) ? dailyRows : []);
    for (const row of rows) {
      const p = normalizeMoonPhaseValue(row?.moon);
      if (p) return p;
    }
    return '';
  }

  function formatClock(raw, lang){
    const d = parseDateMaybe(raw);
    if (!d) return String(raw || '').trim();
    return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', {
      hour:'2-digit', minute:'2-digit'
    }).format(d);
  }

  function toForecastArray(value){
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      if (Array.isArray(value.forecast)) return value.forecast;
      if (Array.isArray(value.forecasts)) return value.forecasts;
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.items)) return value.items;
    }
    if (typeof value !== 'string') return [];
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.forecast)) return parsed.forecast;
        if (Array.isArray(parsed.forecasts)) return parsed.forecasts;
        if (Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed.items)) return parsed.items;
      }
      return [];
    } catch {
      return [];
    }
  }

  function readForecastRows(st){
    const attrs = st?.attributes || {};
    const candidates = [
      attrs.forecast,
      attrs.forecasts,
      attrs.daily_forecast,
      attrs.hourly_forecast,
      attrs.forecast_daily,
      attrs.forecast_hourly,
      attrs.data?.forecast,
      attrs.data?.forecasts,
      attrs.weather?.forecast
    ];
    for (const [key, value] of Object.entries(attrs)) {
      if (!/forecast|vorhersage/i.test(key)) continue;
      candidates.push(value);
    }
    for (const candidate of candidates) {
      const rows = toForecastArray(candidate);
      if (rows.length) return rows;
    }
    return [];
  }

  function readForecastRowsFromObject(obj, wantedEntityId){
    if (!obj || typeof obj !== 'object') return [];
    const wanted = String(wantedEntityId || '').trim().toLowerCase();

    const direct = toForecastArray(obj);
    if (direct.length) return direct;

    const buckets = [
      obj.service_response,
      obj.response,
      obj.data,
      obj.result
    ];

    for (const bucket of buckets) {
      if (!bucket || typeof bucket !== 'object') continue;
      if (wanted && bucket[wanted]) {
        const rows = toForecastArray(bucket[wanted]?.forecast ?? bucket[wanted]?.forecasts ?? bucket[wanted]);
        if (rows.length) return rows;
      }
      for (const [key, value] of Object.entries(bucket)) {
        if (wanted && String(key).trim().toLowerCase() !== wanted) continue;
        const rows = toForecastArray(value?.forecast ?? value?.forecasts ?? value);
        if (rows.length) return rows;
      }
      for (const value of Object.values(bucket)) {
        const rows = toForecastArray(value?.forecast ?? value?.forecasts ?? value);
        if (rows.length) return rows;
      }
    }

    for (const value of Object.values(obj)) {
      const rows = toForecastArray(value?.forecast ?? value?.forecasts ?? value);
      if (rows.length) return rows;
    }

    return [];
  }

  async function fetchForecastRowsFromService(hass, entityId){
    if (!hass?.callApi || !entityId) return [];
    const path = 'services/weather/get_forecasts?return_response';
    const types = ['daily', 'hourly'];
    for (const type of types) {
      try {
        const resp = await hass.callApi('POST', path, { entity_id: entityId, type });
        if (Array.isArray(resp)) {
          for (const item of resp) {
            const rows = readForecastRowsFromObject(item, entityId);
            if (rows.length) return rows;
          }
          continue;
        }
        const rows = readForecastRowsFromObject(resp, entityId);
        if (rows.length) return rows;
      } catch {
        // Try next type / fallback.
      }
    }
    return [];
  }

  async function fetchForecastBundle(hass, entityId){
    const out = { daily: [], hourly: [] };
    if (!hass?.callApi || !entityId) return out;
    const path = 'services/weather/get_forecasts?return_response';
    for (const type of ['daily', 'hourly']) {
      try {
        const resp = await hass.callApi('POST', path, { entity_id: entityId, type });
        let rows = [];
        if (Array.isArray(resp)) {
          for (const item of resp) {
            rows = readForecastRowsFromObject(item, entityId);
            if (rows.length) break;
          }
        } else {
          rows = readForecastRowsFromObject(resp, entityId);
        }
        if (type === 'daily') out.daily = rows;
        if (type === 'hourly') out.hourly = rows;
      } catch {
        // Ignore and keep fallback.
      }
    }
    return out;
  }

  function rowAstroSignalCount(row){
    if (!row || typeof row !== 'object') return 0;
    let score = 0;
    if (Number.isFinite(row.uv)) score += 1;
    if (row.sunrise) score += 1;
    if (row.sunset) score += 1;
    if (row.moon) score += 1;
    if (row.moonrise) score += 1;
    if (row.moonset) score += 1;
    if (Number.isFinite(row.sunElevation)) score += 1;
    if (Number.isFinite(row.moonElevation)) score += 1;
    return score;
  }

  function valueMissing(v){
    if (v === null || v === undefined) return true;
    if (typeof v === 'number') return !Number.isFinite(v);
    if (typeof v === 'string') return String(v).trim().length === 0;
    return false;
  }

  function mergeRowMissing(base, extra){
    if (!base || !extra) return base;
    const fields = [
      'uv',
      'sunrise',
      'sunset',
      'moon',
      'moonrise',
      'moonset',
      'sunElevation',
      'moonElevation',
      'humidity',
      'windDir',
      'windSpeed',
      'windGust',
      'pollen',
      'precipProb',
      'precipAmount'
    ];
    for (const key of fields) {
      if (valueMissing(base[key]) && !valueMissing(extra[key])) base[key] = extra[key];
    }
    return base;
  }

  function nearestRowByTime(rows, dt, toleranceMs){
    if (!Array.isArray(rows) || !rows.length || !(dt instanceof Date) || Number.isNaN(dt.getTime())) return null;
    let best = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    const t = dt.getTime();
    for (const r of rows) {
      const d = r?.dt;
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
      const diff = Math.abs(d.getTime() - t);
      if (diff < bestDiff) {
        best = r;
        bestDiff = diff;
      }
    }
    return bestDiff <= toleranceMs ? best : null;
  }

  function mergeForecastRows(baseRows, extraRows, toleranceMs){
    if (!Array.isArray(baseRows) || !baseRows.length) return Array.isArray(extraRows) ? extraRows.slice() : [];
    if (!Array.isArray(extraRows) || !extraRows.length) return baseRows;
    const merged = baseRows.map((row)=> ({ ...row }));
    for (const row of merged) {
      const match = nearestRowByTime(extraRows, row.dt, toleranceMs);
      if (match) mergeRowMissing(row, match);
    }
    return merged;
  }

  function detectAstroEntityId(hass, baseEntityId){
    const states = hass?.states || {};
    const base = String(baseEntityId || '').trim().toLowerCase();
    let bestId = '';
    let bestScore = -1;
    for (const [entityId, st] of Object.entries(states)) {
      const id = String(entityId || '').trim().toLowerCase();
      if (!id.startsWith('weather.')) continue;
      if (!id || id === base) continue;
      const rawRows = readForecastRows(st);
      if (!rawRows.length) continue;
      const rows = rawRows.slice(0, 72).map(normalizeForecastRow);
      let score = 0;
      for (const r of rows) score += rowAstroSignalCount(r);
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    return bestScore > 0 ? bestId : '';
  }

  function createController(options){
    const opts = options || {};
    const el = opts.elements || {};
    let forecastAutoRefreshTimer = null;
    let forecastAutoRefreshDayKey = '';
    const t = (key)=> {
      try { return typeof opts.t === 'function' ? String(opts.t(key) || key) : key; }
      catch { return key; }
    };

    function getSettings(){
      const raw = typeof opts.getSettings === 'function' ? opts.getSettings() : {};
      return normalizeWeatherSettings(raw);
    }

    function setSettings(next){
      if (typeof opts.setSettings === 'function') opts.setSettings(normalizeWeatherSettings(next));
    }

    function getHass(){
      if (typeof opts.getHass === 'function') return opts.getHass();
      return null;
    }

    function getLang(){
      return (typeof opts.getLang === 'function' ? opts.getLang() : 'de') === 'en' ? 'en' : 'de';
    }

    function getDialog(){
      if (typeof opts.getDialog === 'function') return opts.getDialog();
      return null;
    }

    function getDialogContent(){
      if (typeof opts.getDialogContent === 'function') return opts.getDialogContent();
      return null;
    }

    function stopForecastAutoRefresh(){
      if (!forecastAutoRefreshTimer) return;
      clearInterval(forecastAutoRefreshTimer);
      forecastAutoRefreshTimer = null;
    }

    function startForecastAutoRefresh(dayKey){
      const key = String(dayKey || '').trim();
      forecastAutoRefreshDayKey = key;
      stopForecastAutoRefresh();
      forecastAutoRefreshTimer = setInterval(()=>{
        const dlg = getDialog();
        if (!dlg || !dlg.open) {
          stopForecastAutoRefresh();
          return;
        }
        openWeatherForecastDialog(forecastAutoRefreshDayKey, { suppressAutoRefreshRestart: true }).catch(()=>{});
      }, 60000);
    }

    function ensureForecastDialogUi(dlg, content){
      if (!dlg || !content) return;

      // Keep dialog content scrollable on small screens.
      dlg.style.position = dlg.style.position || 'relative';
      dlg.style.maxWidth = dlg.style.maxWidth || 'min(96vw, 1400px)';
      dlg.style.maxHeight = '92vh';
      dlg.style.overflow = 'hidden';

      content.style.maxHeight = 'calc(92vh - 16px)';
      content.style.overflow = 'auto';
      content.style.webkitOverflowScrolling = 'touch';
      content.style.overscrollBehavior = 'contain';
      content.style.paddingTop = '34px';

      // Persistent close button always visible in top-right of popup.
      let closeBtn = dlg.querySelector('.weather-forecast-xclose');
      if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'weather-forecast-xclose';
        closeBtn.setAttribute('aria-label', t('weatherForecastClose'));
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', ()=> dlg.close());
        dlg.appendChild(closeBtn);
      }
      closeBtn.title = t('weatherForecastClose');
      closeBtn.setAttribute('aria-label', t('weatherForecastClose'));
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '8px';
      closeBtn.style.right = '10px';
      closeBtn.style.zIndex = '1000';
      closeBtn.style.width = '30px';
      closeBtn.style.height = '30px';
      closeBtn.style.borderRadius = '999px';
      closeBtn.style.border = '1px solid rgba(15, 23, 42, 0.2)';
      closeBtn.style.background = 'rgba(255, 255, 255, 0.96)';
      closeBtn.style.color = '#0f172a';
      closeBtn.style.fontSize = '20px';
      closeBtn.style.lineHeight = '1';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.display = 'grid';
      closeBtn.style.placeItems = 'center';
      closeBtn.style.padding = '0';
      closeBtn.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.12)';

      // Hide legacy bottom close button when present.
      const legacyCloseBtn = dlg.querySelector('#weather-forecast-close');
      if (legacyCloseBtn) legacyCloseBtn.style.display = 'none';
    }

    function formatForecastTime(raw){
      const v = String(raw || '').trim();
      if (!v) return '';
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return v;
      return new Intl.DateTimeFormat(getLang()==='de'?'de-DE':'en-US', {
        weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
      }).format(d);
    }

    function formatDayLabel(d){
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
      return new Intl.DateTimeFormat(getLang()==='de'?'de-DE':'en-US', {
        weekday:'short', day:'2-digit', month:'2-digit'
      }).format(d);
    }

    function formatHourLabel(d){
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
      return new Intl.DateTimeFormat(getLang()==='de'?'de-DE':'en-US', {
        day:'2-digit', month:'2-digit', hour:'2-digit'
      }).format(d);
    }

    function formatWindDirection(v){
      const n = Number(v);
      if (Number.isFinite(n)) {
        const dirs = ['N','NO','O','SO','S','SW','W','NW'];
        const idx = Math.round(((n % 360) / 45)) % 8;
        return dirs[(idx + 8) % 8];
      }
      return String(v || '').trim();
    }

    function renderMetricRows(row, unitRaw, cfg){
      const metrics = [];
      if (cfg.showHumidity && Number.isFinite(row.humidity)) {
        metrics.push({ label: t('weatherForecastHumidity'), value: `${Math.round(row.humidity)}%` });
      }
      if (cfg.showWindDirection && row.windDir) {
        metrics.push({ label: t('weatherForecastWindDirection'), value: formatWindDirection(row.windDir) });
      }
      if (cfg.showWindSpeed && Number.isFinite(row.windSpeed)) {
        metrics.push({ label: t('weatherForecastWindSpeed'), value: `${Math.round(row.windSpeed)} km/h` });
      }
      if (cfg.showPollen && row.pollen) {
        metrics.push({ label: t('weatherForecastPollen'), value: row.pollen });
      }
      return metrics.map((m)=> `<div class="weather-day-metric"><span>${escapeHtml(m.label)}</span><strong>${escapeHtml(m.value)}</strong></div>`).join('');
    }

    function buildDayStrip(rows, unitRaw, cfg){
      if (!Array.isArray(rows) || !rows.length) return '';
      const means = rows.slice(0, 8).map((row)=>{
        const hi = convertTempNumeric(row.temp, unitRaw, cfg.tempUnit);
        const lo = Number.isFinite(row.low) ? convertTempNumeric(row.low, unitRaw, cfg.tempUnit) : hi;
        if (!Number.isFinite(hi) && !Number.isFinite(lo)) return null;
        if (Number.isFinite(hi) && Number.isFinite(lo)) return (hi + lo) / 2;
        return Number.isFinite(hi) ? hi : lo;
      });
      const finiteMeans = means.filter(Number.isFinite);
      const minMean = finiteMeans.length ? Math.min(...finiteMeans) : 0;
      const maxMean = finiteMeans.length ? Math.max(...finiteMeans) : 1;
      const meanSpread = Math.max(1, maxMean - minMean);
      const items = rows.slice(0, 8).map((row, idx)=>{
        const label = row.dt ? formatDayLabel(row.dt) : '—';
        const icon = weatherIconForState(row.condition);
        const hi = formatTempValue(row.temp, unitRaw, cfg.tempUnit);
        const lo = Number.isFinite(row.low) ? formatTempValue(row.low, unitRaw, cfg.tempUnit) : '';
        const mean = Number.isFinite(means[idx]) ? means[idx] : ((minMean + maxMean) / 2);
        const norm = ((mean - minMean) / meanSpread) - 0.5;
        const swayPx = -(norm * 14);
        return `<div class="weather-strip-item weather-strip-item-sway">
          <div class="weather-strip-day">${escapeHtml(label)}</div>
          <iconify-icon icon="${escapeHtml(icon)}" style="transform:translateY(${swayPx.toFixed(1)}px)"></iconify-icon>
          <div class="weather-strip-temp">${escapeHtml(lo ? `${lo} / ${hi}` : hi)}</div>
        </div>`;
      }).join('');
      return `<div class="weather-strip">${items}</div>`;
    }

    function buildHourlyChart(rows, unitRaw, cfg, firstDay, sunCtx, currentMoonPhase){
      if (!Array.isArray(rows) || rows.length < 2) return '';
      const dayWidth = 250;
      const width = Math.max(760, Math.round(cfg.forecastDays * dayWidth) + 48);
      const height = 520;
      const padL = 50;
      const padR = 20;
      const padT = 16;
      const padB = 26;
      const tempTop = padT;
      const tempBottom = 112;
      const rainTop = 136;
      const rainBottom = 200;
      const windTop = 224;
      const windBottom = 280;
      const windMid = (windTop + windBottom) / 2;
      const uvTop = 304;
      const uvBottom = 354;
      const astroTop = 392;
      const astroBottom = 432;
      const astroMid = (astroTop + astroBottom) / 2;
      const labelY = 490;
      const dayLabelY = 506;
      const values = rows.map((r)=>{
        const rawVal = Number.isFinite(r.feelsLike) ? Number(r.feelsLike) : Number(r.temp);
        return convertTempNumeric(rawVal, unitRaw, cfg.tempUnit);
      }).filter(Number.isFinite);
      if (!values.length) return '';
      const min = Math.min(...values);
      const max = Math.max(...values);
      const spread = Math.max(1, max - min);
      const tempUnit = resolveTempUnit(unitRaw, cfg.tempUnit);
      const plotW = width - padL - padR;
      const baseDay = firstDay || startOfDay(rows[0]?.dt) || new Date();
      const xForTime = (d)=> {
        const dayDelta = diffDays(d, baseDay);
        const hourFrac = (d.getHours() + d.getMinutes() / 60) / 24;
        const rel = (dayDelta + hourFrac) / Math.max(1, cfg.forecastDays);
        return padL + (plotW * Math.max(0, Math.min(1, rel)));
      };
      const yForTemp = (v)=> tempTop + ((tempBottom - tempTop) * (1 - ((v - min) / spread)));
      const pathTemp = rows.map((r, idx)=>{
        const sourceVal = Number.isFinite(r.feelsLike) ? r.feelsLike : r.temp;
        const tempVal = convertTempNumeric(sourceVal, unitRaw, cfg.tempUnit);
        const x = xForTime(r.dt);
        const y = yForTemp(Number.isFinite(tempVal) ? tempVal : min);
        return `${idx ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ');
      const uvValues = rows.map((r)=> Number.isFinite(r.uv) ? Math.max(0, r.uv) : 0);
      const uvMax = Math.max(1, ...uvValues);
      const uvPath = rows.map((r, idx)=>{
        const x = xForTime(r.dt);
        const uvNorm = clamp01((Number(r.uv) || 0) / uvMax);
        const y = uvBottom - ((uvBottom - uvTop) * uvNorm);
        return `${idx ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ');
      const tempNums = rows.map((r)=>{
        const rawVal = Number.isFinite(r.feelsLike) ? Number(r.feelsLike) : Number(r.temp);
        return convertTempNumeric(rawVal, unitRaw, cfg.tempUnit);
      }).filter(Number.isFinite);
      const stats = meanAndStd(tempNums);
      const meanY = yForTemp(stats.mean);
      const bandTop = yForTemp(stats.mean + stats.std);
      const bandBottom = yForTemp(stats.mean - stats.std);
      const precipValuesBase = rows.map((r)=> Number.isFinite(r.precipAmount) ? Math.max(0, r.precipAmount) : 0);
      const minuteMs = 60 * 1000;
      const nowMs = Date.now();
      const fineUntilMs = nowMs + (6 * 3600 * 1000);
      const precipRenderMap = new Map();
      const addPrecipPoint = (dt, value)=>{
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return;
        const key = dt.getTime();
        if (!precipRenderMap.has(key)) precipRenderMap.set(key, { dt, precipAmount: Math.max(0, Number(value) || 0) });
      };
      rows.forEach((r, idx)=> addPrecipPoint(r.dt, precipValuesBase[idx]));
      for (let i = 0; i < rows.length - 1; i++) {
        const a = rows[i];
        const b = rows[i + 1];
        if (!(a?.dt instanceof Date) || !(b?.dt instanceof Date)) continue;
        const aMs = a.dt.getTime();
        const bMs = b.dt.getTime();
        if (!Number.isFinite(aMs) || !Number.isFinite(bMs) || bMs <= aMs) continue;
        const segStart = Math.max(aMs, nowMs);
        const segEnd = Math.min(bMs, fineUntilMs);
        if (segEnd <= segStart) continue;
        const p1 = Number.isFinite(a.precipAmount) ? Math.max(0, Number(a.precipAmount)) : 0;
        const p2 = Number.isFinite(b.precipAmount) ? Math.max(0, Number(b.precipAmount)) : 0;
        let tMs = Math.ceil(segStart / minuteMs) * minuteMs;
        for (; tMs < segEnd; tMs += minuteMs) {
          const p = (tMs - aMs) / (bMs - aMs);
          addPrecipPoint(new Date(tMs), p1 + ((p2 - p1) * p));
        }
      }
      const precipRenderRows = Array.from(precipRenderMap.values()).sort((a,b)=> a.dt - b.dt);
      const precipRenderValues = precipRenderRows.map((r)=> Math.max(0, Number(r.precipAmount) || 0));
      const maxPrecip = Math.max(0.1, ...precipRenderValues, ...precipValuesBase);
      const yForPrecip = (v)=> rainBottom - ((rainBottom - rainTop) * (Math.max(0, v) / maxPrecip));
      const sampledIdx = rows.map((_, idx)=> idx).filter((idx)=> idx % 4 === 0 || idx === rows.length - 1);
      const showTemp = cfg.showTemperature !== false;
      const showRain = (cfg.showPrecipProbability !== false) || !!cfg.showPrecipAmount;
      const showRainAmount = !!cfg.showPrecipAmount;
      const showWindSpeed = !!cfg.showWindSpeed;
      const showWindDir = !!cfg.showWindDirection;
      const showWind = showWindSpeed || showWindDir;
      const showUv = !!cfg.showPollen;
      const showSun = !!cfg.showSunrise || !!cfg.showSunset;
      const showMoon = !!cfg.showMoonPhase;
      const showAstro = showSun || showMoon;
      const precipSteps = precipRenderRows.map((row, idx)=>{
        const x1 = xForTime(row.dt);
        const x2Raw = idx < precipRenderRows.length - 1 ? xForTime(precipRenderRows[idx + 1].dt) : (width - padR);
        const x2 = Math.max(x1 + 1.5, x2Raw);
        const y = yForPrecip(precipRenderValues[idx]);
        const w = x2 - x1;
        return `<rect x="${x1.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${Math.max(1, (rainBottom - y)).toFixed(2)}" class="weather-chart-rain-step"></rect>`;
      }).join('');
      const precipLabels = sampledIdx.map((idx)=>{
        const row = rows[idx];
        const x = xForTime(row.dt);
        const val = precipValuesBase[idx];
        const y = yForPrecip(val);
        return `<text x="${x.toFixed(2)}" y="${(Math.max(rainTop + 10, y - 4)).toFixed(2)}" text-anchor="middle" class="weather-chart-precip-value">${val.toFixed(1)} mm</text>`;
      }).join('');
      const tempLabels = sampledIdx.map((idx)=>{
        const row = rows[idx];
        const sourceVal = Number.isFinite(row.feelsLike) ? row.feelsLike : row.temp;
        const tempVal = convertTempNumeric(sourceVal, unitRaw, cfg.tempUnit);
        if (!Number.isFinite(tempVal)) return '';
        const x = xForTime(row.dt);
        const y = yForTemp(tempVal);
        return `<text x="${x.toFixed(2)}" y="${(y - 8).toFixed(2)}" text-anchor="middle" class="weather-chart-temp-value">${Math.round(tempVal)}°${tempUnit}</text>`;
      }).join('');
      const windValues = rows.map((r)=> Number.isFinite(r.windSpeed) ? Math.max(0, Number(r.windSpeed)) : 0);
      const maxWind = Math.max(1, ...windValues);
      const yForWind = (v)=> windMid - ((windMid - windTop) * (Math.max(0, v) / maxWind));
      const windBars = sampledIdx.map((idx)=>{
        const row = rows[idx];
        const x = xForTime(row.dt);
        const v = windValues[idx];
        const y = yForWind(v);
        const cls = windCategoryClass(v);
        return `<rect x="${(x - 4).toFixed(2)}" y="${y.toFixed(2)}" width="8" height="${Math.max(1, (windMid - y)).toFixed(2)}" rx="1.6" class="weather-chart-wind-bar ${cls}"></rect>`;
      }).join('');
      const windArrows = sampledIdx.map((idx)=>{
        const row = rows[idx];
        const deg = windBearingDeg(row.windDir);
        if (!Number.isFinite(deg)) return '';
        const x = xForTime(row.dt);
        const y = windMid + 14;
        const len = 10;
        const rad = (deg * Math.PI) / 180;
        const dx = Math.sin(rad) * len;
        const dy = -Math.cos(rad) * len;
        const tx = x + dx;
        const ty = y + dy;
        const head = 3.2;
        const lx = tx - (dx * 0.35) - (Math.cos(rad) * head);
        const ly = ty - (dy * 0.35) - (Math.sin(rad) * head);
        const rx = tx - (dx * 0.35) + (Math.cos(rad) * head);
        const ry = ty - (dy * 0.35) + (Math.sin(rad) * head);
        return `<g class="weather-chart-wind-arrow">
          <line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${tx.toFixed(2)}" y2="${ty.toFixed(2)}"></line>
          <polygon points="${tx.toFixed(2)},${ty.toFixed(2)} ${lx.toFixed(2)},${ly.toFixed(2)} ${rx.toFixed(2)},${ry.toFixed(2)}"></polygon>
        </g>`;
      }).join('');
      const windTickVals = [0, maxWind / 2, maxWind];
      const windTicks = windTickVals.map((v)=>{
        const y = yForWind(v);
        const txt = `${Math.round(v)} km/h`;
        return `<g>
          <line x1="${(padL - 6).toFixed(2)}" y1="${y.toFixed(2)}" x2="${padL.toFixed(2)}" y2="${y.toFixed(2)}" class="weather-chart-axis-tick"></line>
          <text x="${(padL - 8).toFixed(2)}" y="${(y + 3).toFixed(2)}" text-anchor="end" class="weather-chart-axis-label">${escapeHtml(txt)}</text>
        </g>`;
      }).join('');
      const signedSunCycle = (row)=>{
        const dt = row.dt;
        const rs = sunRiseSetForDate(dt, row, sunCtx);
        const sr = rs.rise;
        const ss = rs.set;
        if (sr && ss && dt >= sr && dt <= ss) {
          const pDay = clamp01((dt - sr) / Math.max(1, ss - sr));
          return Math.sin(Math.PI * pDay);
        }
        if (sr && ss && dt < sr) {
          const prevSunset = new Date(ss.getTime() - 86400000);
          const pNight = clamp01((dt - prevSunset) / Math.max(1, sr - prevSunset));
          return -Math.sin(Math.PI * pNight);
        }
        if (sr && ss && dt > ss) {
          const nextSunrise = new Date(sr.getTime() + 86400000);
          const pNight = clamp01((dt - ss) / Math.max(1, nextSunrise - ss));
          return -Math.sin(Math.PI * pNight);
        }
        if (Number.isFinite(row.sunElevation)) {
          return Math.max(-1, Math.min(1, Number(row.sunElevation) / 90));
        }
        const hr = (dt.getHours() + (dt.getMinutes() / 60)) / 24;
        return Math.sin((2 * Math.PI * hr) - (Math.PI / 2));
      };
      const yForAstroSigned = (v)=> astroMid - (Math.max(-1, Math.min(1, v)) * ((astroBottom - astroTop) / 2));
      const firstDt = rows[0]?.dt instanceof Date ? rows[0].dt : null;
      const lastDt = rows[rows.length - 1]?.dt instanceof Date ? rows[rows.length - 1].dt : null;
      const astroRows = [];
      if (firstDt && lastDt && !Number.isNaN(firstDt.getTime()) && !Number.isNaN(lastDt.getTime())) {
        const startMs = firstDt.getTime();
        const endMs = lastDt.getTime();
        const stepMs = 60 * 1000; // minutely
        for (let ms = startMs; ms <= endMs; ms += stepMs) astroRows.push({ dt: new Date(ms) });
        if (!astroRows.length || astroRows[astroRows.length - 1].dt.getTime() !== endMs) astroRows.push({ dt: new Date(endMs) });
      }
      const sunRows = astroRows.length ? astroRows : rows;
      const sunValues = sunRows.map((r)=> signedSunCycle(r));
      const sunPathStrong = buildConditionalPath(sunRows, sunValues, xForTime, yForAstroSigned, (v)=> Number.isFinite(v) && v >= 0);
      const sunPathDim = buildConditionalPath(sunRows, sunValues, xForTime, yForAstroSigned, (v)=> Number.isFinite(v) && v < 0);
      const astroBandRows = astroRows.length ? astroRows : rows;
      const astroBands = astroBandRows.map((r, idx)=>{
        const x1 = xForTime(r.dt);
        const x2Raw = idx < astroBandRows.length - 1 ? xForTime(astroBandRows[idx + 1].dt) : (width - padR);
        const x2 = Math.max(x1 + 1.2, x2Raw);
        const dtMid = new Date(r.dt.getTime() + ((x2Raw > x1 && idx < astroBandRows.length - 1) ? (astroBandRows[idx + 1].dt - r.dt) / 2 : 30 * 60000));
        const sunCycleMid = signedSunCycle({ ...r, dt: dtMid });
        const tone = clamp01(Math.abs(sunCycleMid));
        const dayR = Math.round(255 + ((255 - 255) * tone));
        const dayG = Math.round(158 + ((226 - 158) * tone));
        const dayB = Math.round(109 + ((122 - 109) * tone));
        const nightR = Math.round(91 + ((11 - 91) * tone));
        const nightG = Math.round(75 + ((20 - 75) * tone));
        const nightB = Math.round(138 + ((56 - 138) * tone));
        const phaseMix = clamp01((sunCycleMid + 0.22) / 0.44); // smooth crossfade around 0
        const rr = Math.round(nightR + ((dayR - nightR) * phaseMix));
        const rg = Math.round(nightG + ((dayG - nightG) * phaseMix));
        const rb = Math.round(nightB + ((dayB - nightB) * phaseMix));
        const fill = `rgb(${rr}, ${rg}, ${rb})`;
        const alphaDay = 0.34 + (0.5 * tone);
        const alphaNight = 0.32 + (0.56 * tone);
        const alpha = alphaNight + ((alphaDay - alphaNight) * phaseMix);
        return `<rect x="${x1.toFixed(2)}" y="${astroTop.toFixed(2)}" width="${(x2 - x1).toFixed(2)}" height="${(astroBottom - astroTop).toFixed(2)}" style="fill:${fill};opacity:${alpha.toFixed(3)}"></rect>`;
      }).join('');
      const moonElevPoints = rows
        .filter((r)=> r?.dt instanceof Date && !Number.isNaN(r.dt.getTime()) && Number.isFinite(r.moonElevation))
        .map((r)=> ({ t: r.dt.getTime(), v: -Math.max(-1, Math.min(1, Number(r.moonElevation) / 90)) }))
        .sort((a,b)=> a.t - b.t);
      let moonPtr = 0;
      const moonValueAt = (dt)=>{
        const t = dt.getTime();
        if (moonElevPoints.length >= 2) {
          while (moonPtr + 1 < moonElevPoints.length && moonElevPoints[moonPtr + 1].t < t) moonPtr++;
          const a = moonElevPoints[moonPtr];
          const b = moonElevPoints[Math.min(moonPtr + 1, moonElevPoints.length - 1)];
          if (a && b && b.t > a.t && t >= a.t && t <= b.t) {
            const p = (t - a.t) / (b.t - a.t);
            return a.v + ((b.v - a.v) * p);
          }
          if (a && t < a.t) return a.v;
          if (b && t > b.t) return b.v;
        }
        return -signedSunCycle({ dt });
      };
      const moonRows = astroRows.length ? astroRows : rows;
      const moonValues = moonRows.map((r)=> moonValueAt(r.dt));
      const moonPathStrong = buildConditionalPath(moonRows, moonValues, xForTime, yForAstroSigned, (v)=> Number.isFinite(v) && v >= 0);
      const moonPathDim = buildConditionalPath(moonRows, moonValues, xForTime, yForAstroSigned, (v)=> Number.isFinite(v) && v < 0);
      const tempTickVals = [min, min + (spread / 2), max];
      const tempTicks = tempTickVals.map((v)=>{
        const y = yForTemp(v);
        return `<g>
          <line x1="${(padL - 6).toFixed(2)}" y1="${y.toFixed(2)}" x2="${padL.toFixed(2)}" y2="${y.toFixed(2)}" class="weather-chart-axis-tick"></line>
          <text x="${(padL - 8).toFixed(2)}" y="${(y + 3).toFixed(2)}" text-anchor="end" class="weather-chart-axis-label">${Math.round(v)}°${tempUnit}</text>
        </g>`;
      }).join('');
      const uvTickVals = [0, Math.round(uvMax / 2), Math.round(uvMax)];
      const uvTicks = uvTickVals.map((v)=>{
        const y = uvBottom - ((uvBottom - uvTop) * (Math.max(0, v) / uvMax));
        return `<text x="${(padL - 8).toFixed(2)}" y="${(y + 3).toFixed(2)}" text-anchor="end" class="weather-chart-axis-label">${v}</text>`;
      }).join('');
      const rainTickVals = [0, maxPrecip / 2, maxPrecip];
      const rainTicks = rainTickVals.map((v)=>{
        const y = yForPrecip(v);
        const txt = `${v.toFixed(1)} mm`;
        return `<g>
          <line x1="${(padL - 6).toFixed(2)}" y1="${y.toFixed(2)}" x2="${padL.toFixed(2)}" y2="${y.toFixed(2)}" class="weather-chart-axis-tick"></line>
          <text x="${(padL - 8).toFixed(2)}" y="${(y + 3).toFixed(2)}" text-anchor="end" class="weather-chart-axis-label">${escapeHtml(txt)}</text>
        </g>`;
      }).join('');
      const dayGuidesTop = Array.from({ length: cfg.forecastDays }).map((_, i)=>{
        const x = padL + (plotW * ((i + 1) / Math.max(1, cfg.forecastDays)));
        return `<line x1="${x.toFixed(2)}" y1="${tempTop}" x2="${x.toFixed(2)}" y2="${astroBottom}" class="weather-chart-dayline-top"></line>`;
      }).join('');
      const iconTrackItems = rows
        .filter((r)=> r?.dt instanceof Date && !Number.isNaN(r.dt.getTime()) && (r.dt.getHours() % 2 === 1))
        .map((r)=>{
          const center = new Date(r.dt.getTime() + (30 * 60000));
          const x = xForTime(center);
          const icon = weatherIconForState(r.condition, { isNight: isNightAt(center, r, sunCtx) });
          const condText = formatConditionLabel(r.condition);
          return `<iconify-icon icon="${escapeHtml(icon)}" class="weather-chart-day-icon" title="${escapeHtml(condText)}" aria-label="${escapeHtml(condText)}" style="left:${x.toFixed(2)}px;transform:translate(-50%, 0)"></iconify-icon>`;
        }).join('');
      const moonPhaseKey = normalizeMoonPhaseValue(currentMoonPhase);
      const moonPhaseBadge = (showMoon && moonPhaseKey)
        ? `<g class="weather-chart-moonphase-badge">
            <text x="${(width - padR - 10).toFixed(2)}" y="${(astroTop - 12).toFixed(2)}" text-anchor="end" style="font-size:15px">${escapeHtml(moonPhaseSymbol(moonPhaseKey))}</text>
            <text x="${(width - padR - 30).toFixed(2)}" y="${(astroTop - 12).toFixed(2)}" text-anchor="end" class="weather-chart-astro-time-label">${escapeHtml(formatConditionLabel(moonPhaseKey))}</text>
          </g>`
        : '';
      const ticks = [];
      for (let d = 0; d < cfg.forecastDays; d++) {
        for (let h = 0; h < 24; h += 4) {
          const rel = (d + (h / 24)) / Math.max(1, cfg.forecastDays);
          const x = padL + (plotW * rel);
          ticks.push(`<text x="${x.toFixed(2)}" y="${labelY}" text-anchor="middle" class="weather-chart-hour-label">${String(h).padStart(2,'0')}:00</text>`);
        }
      }
      const dayTicks = Array.from({ length: cfg.forecastDays }).map((_, d)=>{
        const mid = new Date(baseDay);
        mid.setDate(baseDay.getDate() + d);
        mid.setHours(12, 0, 0, 0);
        const x = xForTime(mid);
        const dayLabel = new Intl.DateTimeFormat(getLang()==='de' ? 'de-DE' : 'en-US', {
          weekday:'short', day:'2-digit', month:'2-digit'
        }).format(mid);
        return `<text x="${x.toFixed(2)}" y="${dayLabelY}" text-anchor="middle" class="weather-chart-day-label">${escapeHtml(dayLabel)}</text>`;
      }).join('');
      const windLegendDefs = [
        ['weather-chart-wind-calm', t('weatherWindCatCalm')],
        ['weather-chart-wind-breeze', t('weatherWindCatBreeze')],
        ['weather-chart-wind-fresh', t('weatherWindCatFresh')],
        ['weather-chart-wind-strong', t('weatherWindCatStrong')],
        ['weather-chart-wind-storm', t('weatherWindCatStorm')],
        ['weather-chart-wind-severe', t('weatherWindCatSevere')],
        ['weather-chart-wind-hurricane', t('weatherWindCatHurricane')],
        ['weather-chart-wind-orkan', t('weatherWindCatOrkan')]
      ];
      let legendX = padL + 6;
      const legendY = windBottom + 10;
      const windLegend = windLegendDefs.map(([cls, label])=>{
        const safeLabel = escapeHtml(label);
        const out = `<g transform="translate(${legendX.toFixed(2)} ${legendY.toFixed(2)})">
          <rect x="0" y="-8" width="8" height="8" rx="1.6" class="${cls}"></rect>
          <text x="12" y="-1" class="weather-chart-wind-legend-label">${safeLabel}</text>
        </g>`;
        legendX += 22 + (String(label || '').length * 5.4);
        return out;
      }).join('');
      const astroLegendY = astroBottom + 10;
      const astroTimeLabels = [];
      const astroTimeLabelY = astroTop - 8;
      const rise = sunCtx?.nextRising;
      const set = sunCtx?.nextSetting;
      if (showSun && !!cfg.showSunrise && rise && firstDt && lastDt && rise >= firstDt && rise <= lastDt) {
        const x = xForTime(rise);
        const txt = formatClock(rise, getLang());
        astroTimeLabels.push(`<text x="${x.toFixed(2)}" y="${astroTimeLabelY.toFixed(2)}" text-anchor="middle" class="weather-chart-astro-time-label">${escapeHtml(txt)}</text>`);
      }
      if (showSun && !!cfg.showSunset && set && firstDt && lastDt && set >= firstDt && set <= lastDt) {
        const x = xForTime(set);
        const txt = formatClock(set, getLang());
        astroTimeLabels.push(`<text x="${x.toFixed(2)}" y="${astroTimeLabelY.toFixed(2)}" text-anchor="middle" class="weather-chart-astro-time-label">${escapeHtml(txt)}</text>`);
      }
      let sunNowMarker = '';
      const now = new Date();
      if (showSun && firstDt && lastDt && now >= firstDt && now <= lastDt) {
        const sunNow = signedSunCycle({ dt: now });
        if (Number.isFinite(sunNow)) {
          const xNow = xForTime(now);
          const yNow = yForAstroSigned(sunNow);
          const isDayNow = sunNow >= 0;
          if (xNow >= padL && xNow <= (width - padR)) {
            if (isDayNow) {
              const rays = Array.from({ length: 8 }).map((_, i)=>{
                const a = (i * Math.PI) / 4;
                const r1 = 6;
                const r2 = 10;
                const x1 = xNow + (Math.cos(a) * r1);
                const y1 = yNow + (Math.sin(a) * r1);
                const x2 = xNow + (Math.cos(a) * r2);
                const y2 = yNow + (Math.sin(a) * r2);
                return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"></line>`;
              }).join('');
              sunNowMarker = `<g class="weather-chart-sun-now weather-chart-sun-now-day">${rays}<circle cx="${xNow.toFixed(2)}" cy="${yNow.toFixed(2)}" r="4.6"></circle></g>`;
            } else {
              sunNowMarker = `<g class="weather-chart-sun-now weather-chart-sun-now-night"><circle cx="${xNow.toFixed(2)}" cy="${yNow.toFixed(2)}" r="4.2"></circle></g>`;
            }
          }
        }
      }
      let moonNowMarker = '';
      if (showMoon && firstDt && lastDt && now >= firstDt && now <= lastDt) {
        const moonNow = moonValueAt(now);
        if (Number.isFinite(moonNow)) {
          const xNow = xForTime(now);
          const yNow = yForAstroSigned(moonNow);
          const phaseSymbol = moonPhaseSymbol(currentMoonPhase || '');
          if (xNow >= padL && xNow <= (width - padR)) {
            moonNowMarker = `<g class="weather-chart-moon-now">
              <circle cx="${xNow.toFixed(2)}" cy="${yNow.toFixed(2)}" r="8.4" fill="rgba(255,255,255,0.92)" stroke="rgba(79,70,229,0.38)" stroke-width="1.2"></circle>
              <text x="${xNow.toFixed(2)}" y="${(yNow + 0.8).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" style="font-size:11px">${escapeHtml(phaseSymbol)}</text>
            </g>`;
          }
        }
      }
      const sideLabels = [
        showTemp ? { text: t('weatherForecastPanelThermal'), y: (tempTop + tempBottom) / 2 } : null,
        showRain ? { text: t('weatherForecastPanelRain'), y: (rainTop + rainBottom) / 2 } : null,
        showWind ? { text: t('weatherForecastPanelWind'), y: (windTop + windBottom) / 2 } : null,
        showUv ? { text: t('weatherForecastPanelUv'), y: (uvTop + uvBottom) / 2 } : null,
        showAstro ? { text: t('weatherForecastPanelAstro'), y: (astroTop + astroBottom) / 2 } : null
      ].filter(Boolean).map((it)=> `<div class="weather-chart-side-item" style="top:${it.y.toFixed(1)}px">${escapeHtml(it.text)}</div>`).join('');
      return `<div class="weather-chart-card">
        <div class="weather-chart-layout">
          <div class="weather-chart-side" style="height:${height}px">${sideLabels}</div>
          <div class="weather-chart-main">
            <div class="weather-chart-icon-track" style="width:${width}px">${iconTrackItems}</div>
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="weather-chart-svg" role="img" aria-label="${escapeHtml(t('weatherForecastHourlyGraph'))}">
          <defs>
            <linearGradient id="pp-temp-grad" x1="0" y1="${tempBottom}" x2="0" y2="${tempTop}" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#4a82d8"></stop>
              <stop offset="50%" stop-color="#95c94d"></stop>
              <stop offset="100%" stop-color="#e06a3d"></stop>
            </linearGradient>
            <linearGradient id="pp-uv-grad" x1="0" y1="${uvBottom}" x2="0" y2="${uvTop}" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#f8d94b" stop-opacity="0.95"></stop>
              <stop offset="100%" stop-color="#ff8b2f" stop-opacity="0.95"></stop>
            </linearGradient>
            <pattern id="pp-rain-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width="6" height="6" fill="rgba(77,146,220,0.18)"></rect>
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(39,112,190,0.8)" stroke-width="1.4"></line>
            </pattern>
          </defs>
          ${showTemp ? tempTicks : ''}
          ${showUv ? uvTicks : ''}
          ${showWind ? windTicks : ''}
          ${showRain ? rainTicks : ''}
          ${showTemp ? `<line x1="${padL}" y1="${tempTop}" x2="${padL}" y2="${tempBottom}" class="weather-chart-axis"></line>` : ''}
          ${showRain ? `<line x1="${padL}" y1="${rainTop}" x2="${padL}" y2="${rainBottom}" class="weather-chart-axis"></line>` : ''}
          ${showTemp ? `<rect x="${padL}" y="${bandTop.toFixed(2)}" width="${plotW}" height="${Math.max(1, (bandBottom - bandTop)).toFixed(2)}" class="weather-chart-band"></rect>` : ''}
          ${showRain ? `<g class="weather-chart-rain">${precipSteps}</g>` : ''}
          ${showTemp ? `<line x1="${padL}" y1="${meanY.toFixed(2)}" x2="${width - padR}" y2="${meanY.toFixed(2)}" class="weather-chart-mean"></line>` : ''}
          ${showTemp ? `<path class="weather-chart-line" d="${pathTemp}"></path>` : ''}
          ${showTemp ? `<g class="weather-chart-temp-values">${tempLabels}</g>` : ''}
          ${(showRain && showRainAmount) ? `<g class="weather-chart-precip-values">${precipLabels}</g>` : ''}
          ${showRain ? `<line x1="${padL}" y1="${rainTop}" x2="${width - padR}" y2="${rainTop}" class="weather-chart-divider"></line>` : ''}
          ${showRain ? `<line x1="${padL}" y1="${rainBottom}" x2="${width - padR}" y2="${rainBottom}" class="weather-chart-divider"></line>` : ''}
          ${showWind ? `<line x1="${padL}" y1="${windTop}" x2="${width - padR}" y2="${windTop}" class="weather-chart-divider"></line>` : ''}
          ${showWind ? `<line x1="${padL}" y1="${windMid}" x2="${width - padR}" y2="${windMid}" class="weather-chart-zero"></line>` : ''}
          ${showWind ? `<line x1="${padL}" y1="${windBottom}" x2="${width - padR}" y2="${windBottom}" class="weather-chart-divider"></line>` : ''}
          ${showWindSpeed ? `<g class="weather-chart-wind">${windBars}</g>` : ''}
          ${showWindDir ? `<g class="weather-chart-wind-arrows">${windArrows}</g>` : ''}
          ${showWindSpeed ? `<g class="weather-chart-wind-legend">${windLegend}</g>` : ''}
          ${showUv ? `<line x1="${padL}" y1="${uvTop}" x2="${width - padR}" y2="${uvTop}" class="weather-chart-divider"></line>` : ''}
          ${showUv ? `<line x1="${padL}" y1="${uvBottom}" x2="${width - padR}" y2="${uvBottom}" class="weather-chart-divider"></line>` : ''}
          ${showUv ? `<path class="weather-chart-uv-line" d="${uvPath}"></path>` : ''}
          ${showAstro ? `<line x1="${padL}" y1="${astroMid}" x2="${width - padR}" y2="${astroMid}" class="weather-chart-zero"></line>` : ''}
          ${showAstro ? `<line x1="${padL}" y1="${astroBottom}" x2="${width - padR}" y2="${astroBottom}" class="weather-chart-divider"></line>` : ''}
          ${showAstro ? `<g class="weather-chart-astro-bg">${astroBands}</g>` : ''}
          ${showSun ? `<path class="weather-chart-sun" d="${sunPathStrong}"></path>` : ''}
          ${showSun ? `<path class="weather-chart-sun-dim" d="${sunPathDim}"></path>` : ''}
          ${showSun ? sunNowMarker : ''}
          ${showMoon ? `<path class="weather-chart-moon" d="${moonPathStrong}"></path>` : ''}
          ${showMoon ? `<path class="weather-chart-moon-dim" d="${moonPathDim}"></path>` : ''}
          ${showMoon ? moonNowMarker : ''}
          ${(showSun && astroTimeLabels.length) ? `<g class="weather-chart-astro-time">${astroTimeLabels.join('')}</g>` : ''}
          ${moonPhaseBadge}
          ${showSun ? `<line x1="${(padL + 4).toFixed(2)}" y1="${astroLegendY.toFixed(2)}" x2="${(padL + 28).toFixed(2)}" y2="${astroLegendY.toFixed(2)}" class="weather-chart-sun"></line>
          <text x="${(padL + 34).toFixed(2)}" y="${(astroLegendY + 3).toFixed(2)}" class="weather-chart-legend-label">${escapeHtml(t('weatherForecastLegendSun'))}</text>` : ''}
          ${showMoon ? `<line x1="${((showSun ? (padL + 104) : (padL + 4))).toFixed(2)}" y1="${astroLegendY.toFixed(2)}" x2="${((showSun ? (padL + 128) : (padL + 28))).toFixed(2)}" y2="${astroLegendY.toFixed(2)}" class="weather-chart-moon"></line>
          <text x="${((showSun ? (padL + 134) : (padL + 34))).toFixed(2)}" y="${(astroLegendY + 3).toFixed(2)}" class="weather-chart-legend-label">${escapeHtml(t('weatherForecastLegendMoon'))}</text>` : ''}
          <g>${dayGuidesTop}</g>
          ${ticks.join('')}
          ${dayTicks}
            </svg>
          </div>
        </div>
      </div>`;
    }

    function updateHeaderWeatherDisplay(){
      if (!el.headerWeatherChip || !el.headerWeatherIcon || !el.headerWeatherTempValue || !el.headerWeatherTempUnit) return;
      const cfg = getSettings();
      setSettings(cfg);
      if (!cfg.enabled || !cfg.entityId) {
        el.headerWeatherChip.style.display = 'none';
        return;
      }
      const hass = getHass();
      const st = hass?.states?.[cfg.entityId];
      if (!st) {
        el.headerWeatherIcon.setAttribute('icon', 'mdi:weather-cloudy-alert');
        setHeaderTempParts(el.headerWeatherTempValue, el.headerWeatherTempUnit, '--°C');
        el.headerWeatherChip.style.display = 'flex';
        return;
      }
      const attrs = st.attributes || {};
      const unitRaw = String(attrs.temperature_unit || '').toUpperCase();
      setHeaderTempParts(
        el.headerWeatherTempValue,
        el.headerWeatherTempUnit,
        formatTempValue(attrs.temperature, unitRaw, cfg.tempUnit)
      );
      const sunState = String(hass?.states?.['sun.sun']?.state || '').trim().toLowerCase();
      const currentState = canonicalWeatherState(st.state);
      let isNightNow = false;
      if (currentState === 'clearnight') isNightNow = true;
      else if (sunState === 'above_horizon') isNightNow = false;
      else if (sunState === 'below_horizon') isNightNow = true;
      else if (typeof attrs.is_day === 'boolean') isNightNow = !attrs.is_day;
      else if (Number.isFinite(Number(attrs.sun_elevation))) isNightNow = Number(attrs.sun_elevation) < 0;
      else isNightNow = isNightAt(new Date(), null, buildSunContext(hass?.states?.['sun.sun']?.attributes));
      const allowNightOverride = isNightNow && (currentState === 'sunny' || currentState === 'partlycloudy' || currentState === 'clear' || currentState === 'cloudy');
      el.headerWeatherIcon.setAttribute('icon', weatherIconForState(st.state, { isNight: allowNightOverride }));
      el.headerWeatherChip.style.display = 'flex';
    }

    async function getCalendarForecastDayMap(){
      const cfg = getSettings();
      setSettings(cfg);
      const out = new Map();
      if (!cfg.enabled || !cfg.entityId) return out;
      const hass = getHass();
      const st = hass?.states?.[cfg.entityId];
      if (!st) return out;
      const unitRaw = String(st?.attributes?.temperature_unit || '').toUpperCase();
      const outUnit = resolveTempUnit(unitRaw, cfg.tempUnit);
      const fmtTemp = (raw)=>{
        const v = convertTempNumeric(raw, unitRaw, cfg.tempUnit);
        if (!Number.isFinite(v)) return '';
        return `${Math.round(v)}°${outUnit}`;
      };

      const fromAttr = readForecastRows(st);
      const bundle = await fetchForecastBundle(hass, cfg.entityId);
      const dailyRaw = bundle.daily.length ? bundle.daily : fromAttr;
      const hourlyRaw = bundle.hourly.length ? bundle.hourly : fromAttr;
      const firstKnown = startOfDay(new Date()) || new Date();
      const endKnown = new Date(firstKnown);
      endKnown.setDate(endKnown.getDate() + cfg.forecastDays);

      const dailyRows = dailyRaw
        .map(normalizeForecastRow)
        .filter((r)=> r.dt && r.dt >= firstKnown && r.dt < endKnown);

      for (const row of dailyRows) {
        const key = dayKeyFromDate(row.dt);
        if (!key) continue;
        const cond = String(row.condition || '').trim();
        const minRaw = Number.isFinite(row.low) ? row.low : row.temp;
        const maxRaw = Number.isFinite(row.temp) ? row.temp : row.low;
        out.set(key, {
          condition: cond,
          label: formatConditionLabel(cond),
          icon: weatherIconForState(cond),
          minTemp: fmtTemp(minRaw),
          maxTemp: fmtTemp(maxRaw)
        });
      }

      if (out.size) return out;

      const hourlyRows = hourlyRaw
        .map(normalizeForecastRow)
        .filter((r)=> r.dt && r.dt >= firstKnown && r.dt < endKnown);
      const bucket = new Map();
      for (const row of hourlyRows) {
        const key = dayKeyFromDate(row.dt);
        if (!key) continue;
        if (!bucket.has(key)) bucket.set(key, { cond: new Map(), min: null, max: null });
        const entry = bucket.get(key);
        const cond = String(row.condition || '').trim() || 'partlycloudy';
        entry.cond.set(cond, (entry.cond.get(cond) || 0) + 1);
        const tv = Number(row.temp);
        if (Number.isFinite(tv)) {
          if (!Number.isFinite(entry.min) || tv < entry.min) entry.min = tv;
          if (!Number.isFinite(entry.max) || tv > entry.max) entry.max = tv;
        }
      }
      for (const [key, entry] of bucket.entries()) {
        let best = '';
        let bestCount = -1;
        for (const [cond, cnt] of entry.cond.entries()) {
          if (cnt > bestCount) {
            bestCount = cnt;
            best = cond;
          }
        }
        out.set(key, {
          condition: best,
          label: formatConditionLabel(best),
          icon: weatherIconForState(best),
          minTemp: fmtTemp(entry.min),
          maxTemp: fmtTemp(entry.max)
        });
      }

      return out;
    }

    async function openWeatherForecastDialog(dayKey, options){
      const dlg = getDialog();
      const content = getDialogContent();
      if (!dlg || !content) return;
      if (!dlg.__ppForecastAutoHooked) {
        dlg.__ppForecastAutoHooked = true;
        dlg.addEventListener('close', ()=> stopForecastAutoRefresh());
      }
      ensureForecastDialogUi(dlg, content);
      const cfg = getSettings();
      const chartCfg = { ...cfg };
      const selectedDay = parseDayKeyLocal(dayKey);
      if (selectedDay) chartCfg.forecastDays = 1;
      const hass = getHass();
      const sunCtx = buildSunContext(hass?.states?.['sun.sun']?.attributes);
      const st = cfg.entityId ? hass?.states?.[cfg.entityId] : null;
      const autoAstroEntityId = (!cfg.astroEntityId || cfg.astroEntityId === cfg.entityId)
        ? detectAstroEntityId(hass, cfg.entityId)
        : '';
      const astroEntityId = (cfg.astroEntityId && cfg.astroEntityId !== cfg.entityId) ? cfg.astroEntityId : autoAstroEntityId;
      const astroSt = astroEntityId ? hass?.states?.[astroEntityId] : null;
      const attrs = st?.attributes || {};
      const unitRaw = String(attrs.temperature_unit || '').toUpperCase();
      const fromAttr = readForecastRows(st);
      const astroFromAttr = readForecastRows(astroSt);
      const bundle = await fetchForecastBundle(hass, cfg.entityId);
      const astroBundle = astroEntityId ? await fetchForecastBundle(hass, astroEntityId) : { daily: [], hourly: [] };
      const dailyRaw = bundle.daily.length ? bundle.daily : fromAttr;
      const hourlyRaw = bundle.hourly;
      let dailyRows = dailyRaw.map(normalizeForecastRow).filter((r)=> r.dt || r.condition);
      let hourlyRows = hourlyRaw.map(normalizeForecastRow).filter((r)=> r.dt && (Number.isFinite(r.temp) || Number.isFinite(r.feelsLike)));
      const astroDailyRaw = astroBundle.daily.length ? astroBundle.daily : astroFromAttr;
      const astroHourlyRaw = astroBundle.hourly.length ? astroBundle.hourly : astroFromAttr;
      const astroDailyRows = astroDailyRaw.map(normalizeForecastRow).filter((r)=> r.dt || r.condition);
      const astroHourlyRows = astroHourlyRaw.map(normalizeForecastRow).filter((r)=> r.dt && rowAstroSignalCount(r) > 0);
      if (!hourlyRows.length && astroHourlyRows.length) hourlyRows = astroHourlyRows.slice();
      if (!dailyRows.length && astroDailyRows.length) dailyRows = astroDailyRows.slice();
      hourlyRows = mergeForecastRows(hourlyRows, astroHourlyRows, 2 * 3600 * 1000);
      dailyRows = mergeForecastRows(dailyRows, astroDailyRows, 18 * 3600 * 1000);
      hourlyRows.sort((a,b)=> a.dt - b.dt);
      const firstKnown = selectedDay || startOfDay(new Date()) || new Date();
      const endKnown = new Date(firstKnown);
      endKnown.setDate(endKnown.getDate() + chartCfg.forecastDays);
      if (!hourlyRows.length && dailyRows.length) {
        const synthesized = [];
        for (const dRow of dailyRows.slice(0, chartCfg.forecastDays)) {
          if (!dRow.dt || !Number.isFinite(dRow.temp) || !Number.isFinite(dRow.low)) continue;
          for (let h = 0; h < 24; h++) {
            const dt = new Date(dRow.dt.getFullYear(), dRow.dt.getMonth(), dRow.dt.getDate(), h, 0, 0, 0);
            if (dt < firstKnown || dt >= endKnown) continue;
            const wave = Math.sin(((h - 6) / 24) * Math.PI * 2) * 0.5 + 0.5;
            const temp = dRow.low + ((dRow.temp - dRow.low) * wave);
            synthesized.push({
              ...dRow,
              dt,
              temp,
              feelsLike: Number.isFinite(dRow.feelsLike) ? dRow.feelsLike : temp
            });
          }
        }
        hourlyRows = synthesized.sort((a,b)=> a.dt - b.dt);
      }
      const hourlyWindow = hourlyRows.filter((r)=> r.dt >= firstKnown && r.dt < endKnown);
      const hourlyTrimmed = hourlyWindow.length ? hourlyWindow : hourlyRows.slice(0, chartCfg.forecastDays * 24);
      const dailyMap = new Map();
      for (const h of hourlyTrimmed) {
        const key = dayKeyFromDate(h.dt);
        if (!key) continue;
        if (!dailyMap.has(key)) {
          dailyMap.set(key, {
            dt: h.dt,
            condition: h.condition,
            temp: h.temp,
            low: h.temp,
            precipProb: h.precipProb,
            precipAmount: h.precipAmount,
            humidity: h.humidity,
            windSpeed: h.windSpeed,
            windDir: h.windDir,
            sunrise: h.sunrise,
            sunset: h.sunset,
            moon: h.moon,
            pollen: h.pollen
          });
          continue;
        }
        const d = dailyMap.get(key);
        if (Number.isFinite(h.temp)) {
          if (!Number.isFinite(d.temp) || h.temp > d.temp) d.temp = h.temp;
          if (!Number.isFinite(d.low) || h.temp < d.low) d.low = h.temp;
        }
      }
      const mergedDailyRaw = dailyRows.length ? dailyRows : Array.from(dailyMap.values());
      const mergedDaily = mergedDailyRaw
        .filter((r)=> !r.dt || (r.dt >= firstKnown && r.dt < endKnown))
        .slice(0, chartCfg.forecastDays);
      if (!mergedDaily.length && !hourlyTrimmed.length) {
        const fallbackGaugeHtml = (window.PPRainGaugeIntegration && typeof window.PPRainGaugeIntegration.renderFromForecastRows === 'function')
          ? window.PPRainGaugeIntegration.renderFromForecastRows([{ dt: new Date(), precipAmount: 0, precipProb: 0 }], {
            lang: getLang(),
            now: new Date(),
            mode: 'popup'
          })
          : '';
        content.innerHTML = `<div class="weather-forecast-v2">${fallbackGaugeHtml}<div class="calendar-empty">${escapeHtml(t('weatherForecastEmpty'))}</div></div>`;
        dlg.showModal();
        if (!(options && options.suppressAutoRefreshRestart)) {
          startForecastAutoRefresh(dayKey);
        }
        return;
      }
      const stripHtml = '';
      const gaugeNow = new Date();
      const rainGaugeHtml = (window.PPRainGaugeIntegration && typeof window.PPRainGaugeIntegration.renderFromForecastRows === 'function')
        ? window.PPRainGaugeIntegration.renderFromForecastRows(hourlyTrimmed, {
          lang: getLang(),
          now: gaugeNow,
          mode: 'popup'
        })
        : '';
      const currentMoonPhase = resolveCurrentMoonPhase(hass, cfg, hourlyTrimmed, mergedDaily);
      const chartHtml = buildHourlyChart(hourlyTrimmed, unitRaw, chartCfg, firstKnown, sunCtx, currentMoonPhase);
      content.innerHTML = `<div class="weather-forecast-v2">
        ${rainGaugeHtml}
        ${stripHtml}
        ${chartHtml}
      </div>`;
      dlg.showModal();
      if (!(options && options.suppressAutoRefreshRestart)) {
        startForecastAutoRefresh(dayKey);
      }
    }

    async function getRainGaugeRows(){
      const cfg = getSettings();
      const hass = getHass();
      if (!cfg.entityId || !hass) return [{ dt: new Date(), precipAmount: 0, precipProb: 0 }];
      const st = hass?.states?.[cfg.entityId] || null;
      const fromAttr = readForecastRows(st);
      const bundle = await fetchForecastBundle(hass, cfg.entityId);
      const fromServiceHourly = await fetchForecastRowsFromService(hass, cfg.entityId);
      const hourlyRaw = fromServiceHourly.length
        ? fromServiceHourly
        : (bundle.hourly.length ? bundle.hourly : fromAttr);
      let rows = hourlyRaw
        .map(normalizeForecastRow)
        .filter((r)=> r.dt && (
          Number.isFinite(r.precipAmount)
          || Number.isFinite(r.precipProb)
          || Number.isFinite(r.temp)
          || Number.isFinite(r.feelsLike)
        ))
        .sort((a,b)=> a.dt - b.dt);
      if (!rows.length) {
        rows = [{ dt: new Date(), precipAmount: 0, precipProb: 0 }];
      }
      return rows;
    }

    async function renderRainGaugeCard(targetEl, options){
      const root = targetEl;
      if (!root) return;
      const renderer = window.PPRainGaugeIntegration?.renderFromForecastRows;
      if (typeof renderer !== 'function') {
        root.innerHTML = '';
        return;
      }
      const rows = await getRainGaugeRows();
      const safeRows = rows.length ? rows : [{ dt: new Date(), precipAmount: 0, precipProb: 0 }];
      const box = root.getBoundingClientRect();
      const compact = (options?.mode === 'dashboard') && (
        (box.width > 0 && box.width < 360)
        || (box.height > 0 && box.height < 300)
      );
      root.innerHTML = renderer(safeRows, {
        lang: getLang(),
        now: new Date(),
        mode: options?.mode || 'dashboard',
        compact
      });
    }

    return {
      normalizeWeatherSettings,
      weatherIconForState,
      updateHeaderWeatherDisplay,
      openWeatherForecastDialog,
      renderRainGaugeCard,
      getCalendarForecastDayMap
    };
  }

  window.PPWeatherIntegration = {
    normalizeWeatherSettings,
    weatherIconForState,
    createController
  };
})();
