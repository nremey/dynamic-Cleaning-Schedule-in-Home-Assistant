(function(){
  'use strict';

  function openDialog(){
    if (typeof window.openShoppingListDialog === 'function') {
      window.openShoppingListDialog();
      return true;
    }
    const dlg = document.getElementById('shopping-list-dialog');
    if (dlg && typeof dlg.showModal === 'function') {
      dlg.showModal();
      return true;
    }
    return false;
  }

  function closeDialog(){
    const dlg = document.getElementById('shopping-list-dialog');
    if (dlg && typeof dlg.close === 'function') {
      dlg.close();
      return true;
    }
    return false;
  }

  async function refreshPanel(){
    if (typeof window.refreshShoppingLayoutPanel === 'function') {
      await window.refreshShoppingLayoutPanel();
      return true;
    }
    return false;
  }

  window.PP_SHOPPINGLIST_API = {
    open: openDialog,
    close: closeDialog,
    refresh: refreshPanel
  };
})();
