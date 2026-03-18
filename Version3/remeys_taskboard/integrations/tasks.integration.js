(function(){
  'use strict';

  const DATA_FILE_NAME = 'tasklist.js';
  const WEBHOOK_ID = 'taskboard_textcontentfile_export';

  function getHaOrigin(){
    try {
      if (window.top && window.top.location && /^https?:/.test(window.top.location.origin)) {
        return window.top.location.origin;
      }
    } catch (_) {}
    if (typeof window.HA_ORIGIN === 'string' && /^https?:/.test(window.HA_ORIGIN)) return window.HA_ORIGIN;
    if (typeof window.location.origin === 'string' && /^https?:/.test(window.location.origin)) return window.location.origin;
    return '';
  }

  function resolveSaveDir(){
    if (typeof window.PP_FILE_SAVE_DIR === 'string' && window.PP_FILE_SAVE_DIR.trim()) {
      return window.PP_FILE_SAVE_DIR.trim().replace(/\/+$/, '') + '/userdata';
    }
    return '/config/www/userdata';
  }

  function toBase64Utf8(str){
    return btoa(unescape(encodeURIComponent(String(str || ''))));
  }

  async function postWebhook(payload){
    const webhookUrl = `${getHaOrigin()}/api/webhook/${WEBHOOK_ID}`;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Webhook ${res.status} - ${text}`);
    try {
      return text ? JSON.parse(text) : { ok: true };
    } catch (_) {
      return { ok: true, raw: text };
    }
  }

  async function callTaskOp(operation, payload){
    const payloadObj = (payload && typeof payload === 'object') ? payload : {};
    const payloadJson = JSON.stringify(payloadObj);
    return postWebhook({
      savingpath: resolveSaveDir(),
      filename: DATA_FILE_NAME,
      operation,
      payload: payloadObj,
      payload_b64: toBase64Utf8(payloadJson)
    });
  }

  async function loadTasklist(){
    const src = `${window.BASE_PATH || './'}userdata/tasklist.js?v=${Date.now()}`;
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Load failed: HTTP ${res.status}`);
    const js = await res.text();

    // Evaluate inside isolated function scope.
    let parsed = [];
    try {
      const fn = new Function(`${js}\nreturn (typeof window.PP_TASKS_DATA !== 'undefined' ? window.PP_TASKS_DATA : (typeof window.TABLE_DATA !== 'undefined' ? window.TABLE_DATA : []));`);
      const data = fn();
      parsed = Array.isArray(data) ? data : [];
    } catch (e) {
      throw new Error(`Failed to parse task data: ${e && e.message ? e.message : e}`);
    }

    window.PP_TASKS_DATA = parsed;
    return parsed;
  }

  function sortTasklistLocal(tasklist, sortBy, order){
    const list = Array.isArray(tasklist) ? tasklist.slice() : [];
    const desc = String(order || 'asc').toLowerCase() === 'desc';
    const key = String(sortBy || 'due').toLowerCase();
    const keyFn = key === 'area'
      ? (r) => String(r && r.Area || '').toLowerCase()
      : key === 'task'
      ? (r) => String(r && r.Task || '').toLowerCase()
      : key === 'last_done'
      ? (r) => String(r && r['Last done [Date]'] || '')
      : (r) => Number.isFinite(Number(r && r['Due in [days]'])) ? Number(r['Due in [days]']) : Number.MAX_SAFE_INTEGER;

    list.sort((a, b) => {
      const av = keyFn(a);
      const bv = keyFn(b);
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
      return 0;
    });
    return list;
  }

  const api = {
    add_task(task){
      return callTaskOp('add_task', { task });
    },
    edit_task(targetId, taskOrPatch){
      const payload = (taskOrPatch && taskOrPatch.task) ? { target_id: targetId, task: taskOrPatch.task } : { target_id: targetId, patch: taskOrPatch || {} };
      return callTaskOp('edit_task', payload);
    },
    delete_task(targetId){
      return callTaskOp('delete_task', { target_id: targetId });
    },
    get_task(targetId){
      return callTaskOp('get_task', { target_id: targetId });
    },
    get_tasklist(filters){
      return callTaskOp('get_tasklist', filters || {});
    },
    sort_tasklist(sortBy, order){
      return callTaskOp('sort_tasklist', { sort_by: sortBy || 'due', order: order || 'asc' });
    },
    load_tasklist: loadTasklist,
    sort_tasklist_local: sortTasklistLocal
  };

  window.PP_TASKS_API = api;
})();
