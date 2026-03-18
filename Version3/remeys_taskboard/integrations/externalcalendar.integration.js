(function(){
  'use strict';

  function getEventsByDate(dayIso){
    const map = window.calendarByDateMap;
    if (!map || typeof map.get !== 'function') return [];
    return Array.isArray(map.get(dayIso)) ? map.get(dayIso) : [];
  }

  function refreshExternalCalendar(){
    if (typeof window.render === 'function') {
      window.render();
      return true;
    }
    return false;
  }

  window.PP_EXTERNAL_CALENDAR_API = {
    get_events_by_date: getEventsByDate,
    refresh: refreshExternalCalendar
  };
})();
