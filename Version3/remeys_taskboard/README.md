# Remey's Taskboard

A Home Assistant web app bundle with:
- `index_mainview.html` (main board)
- `shoppingliste.popup.html` (local shopping list or `todo.*` sync, with a visual product-picker interface)
- `foodcatalog.editor.html` (product catalog editor)
- `Screensaver_calendar.html` (screensaver/calendar view)

## 1) Folder Deployment

Copy this folder remeys_taskboard with its content to HomeAssistant:
- `/config/www/community/remeys_taskboard`

Final URL:
- `https://<HA_HOST>:8123/local/community/remeys_taskboard/index_mainview.html`
- internal call e.g. within website panel `/local/community/remeys_taskboard/index_mainview.html` is enough

Included structure (ready):
- `integrations/`
- `userdata/`
- `usersettings/`
- `screensaver/`
- `packages/`
- `scripts/`


The files of the subfolder `packages/` need to be copied to the HomeAssistant folder `/homeassistant/packages/` and in the `configuration.yaml` include following lines:

```
homeassistant:
  packages: !include_dir_named packages
```

Without this backend, the editing UI still works, but persistent file writes will fail.
For saving/exporting files from the UI (tasks, catalog, settings, shopping sync config), enable this webhook/file-writer backend.

Shell commands and automations used by the backend package (`packages/taskboard_webhooks_fixed.yaml`):
- `shell_command.taskboard_textcontentfile_save` (generic file save from base64 payload)
- `shell_command.taskboard_task_operation` (tasklist operations via `scripts/task_ops.py`)
- `shell_command.taskboard_product_catalog_operation` (catalog operations via `scripts/product_catalog_ops.py`)
- `shell_command.taskboard_mark_done_task` (mark one task done via UUID/assignee)
- `shell_command.taskboard_due_digest` (runs `scripts/taskboard_due_digest_script.py`)
- Automation `taskboard_textcontentfile_export` (`Webhook: remey_taskboard_file_export`)
- Automation `taskboard_due_digest_webhook_notify` (`Taskboard: Due Digest Webhook -> Device`)
- Automation `taskboard_daily_digest_trigger` (`Taskboard: Daily Digest Trigger`)


If all files und subfolder are copied to  their respected path a restart of HA is necessary.


## 2) Home Assistant Auth (URL mode, not iframe)

This project supports multiple auth paths:

1. Native HA context (best case)
- If opened inside HA (for example via Website card/iframe) and the session is active, the app can use HA context/session automatically.

2. Token from browser storage
- If native HA context is not available, it tries `localStorage.hassTokens`.
- Works when same HA origin/session is available in the browser.

3. Manual token fallback (`ha_auth.js`)
- Edit `ha_auth.js`:

```js
window.PP_HA_AUTH = {
  longLivedBearerToken: 'YOUR_LONG_LIVED_ACCESS_TOKEN'
};
```

Use this when:
- kiosk browser,
- separate window,
- cross-context usage where HA session access fails.


## 3) What You Can Do (some Screenshots added for context)

## Main Board (`index_mainview.html`)
  <img width="50%" height="50%" alt="light theme" src="https://github.com/user-attachments/assets/9a7a12ec-fa55-4312-a130-6b473d1907a8" />
  
  <img width="50%" height="50%" alt="dark theme" src="https://github.com/user-attachments/assets/6cc91265-cbb4-4a98-a3ac-ca3e25847be7" />

- Task board with grouped/list/calendar/family views
    - calendar views are enhanced with calendar events, or weather forecast (fitting icon and temperature range)

  <img width="50%" height="50%" alt="View by areas" src="https://github.com/user-attachments/assets/ba7b5441-2b15-4348-9f98-d20d529f110e" />
  <img width="50%" height="50%" alt="view: calendar week" src="https://github.com/user-attachments/assets/a8694660-9fa1-4414-9eda-a94c33b7915b" />
  <img width="50%" height="50%" alt="view: calendar month" src="https://github.com/user-attachments/assets/26715b75-3487-45b3-ad33-91088634840f" />
  <img width="50%" height="50%" alt="view: calendar list" src="https://github.com/user-attachments/assets/8fd7a203-8b33-44b1-92a3-9d5cfd3be70a" />
  <img width="50%" height="50%" alt="view: family calendar " src="https://github.com/user-attachments/assets/92a8f4c7-1003-4cc4-bec5-239fba256c09" />

- User settings + layout builder + mobile ordering (development focus are larger screens, but small screens can work with adjustments in display optionen and settings)
- Free Lovelace/custom card embedding via YAML
- Shopping panel integration
- Weather/calendar overlays
- Screensaver launcher

- Add/Edit Task Editor:
  - absolute minimum is picking an area and a task name. default recurring pattern is 7 days. Otherwise adapt the template default values.
  <img width="50%" height="50%" alt="Bildschirmfoto vom 2026-03-08 14-17-29" src="https://github.com/user-attachments/assets/fb23846f-24cf-4369-8ebb-62c1639d63f8" />
  <img width="50%" height="50%" alt="Bildschirmfoto vom 2026-03-08 14-17-46" src="https://github.com/user-attachments/assets/a9320679-a74b-49dd-8490-f2eb96abb875" />


## Shopping Popup (`shoppingliste.popup.html`)
  <img width="50%" height="50%" alt="Shoppinglist Picker popup" src="https://github.com/user-attachments/assets/4885e80b-3c70-4428-8c74-4ddae04e41cc" />

- Live shopping list view
- Todo-entity sync (`todo.*`)
- Product catalog picker + categories
- Add/remove/toggle list items
- Can also be used without binding a `todo.*` entity.
- In browser mode (not in HA Companion app), an open print/PDF export option is supported.

## Catalog Editor (`foodcatalog.editor.html`)
  <img width="50%" height="50%" alt="Screenshot of the editor of food/product catalog" src="https://github.com/user-attachments/assets/1a361f19-7d6f-4b44-b69f-3773d6f6b050" />

- Manage `integrations/product-catalog.json`
- Edit names, icons, categories, multilingual labels
- Save back through webhook backend
- Product catalog supports bilingual entries (`de`/`en`) and product aliases (if aliases are stored per product).
- Current development status: selected icons, translations, aliases, and product set are still in active development.
- Existing product set is currently oriented to supermarket choices in Germany.
- No alcohol or cigarettes are included in the current catalog.
- Meat, fish, and poultry entries are intentionally limited at the moment (vegetarian/vegan-focused household).
- Through the catalog editor, all entries can be added, changed, or removed.

## Screensaver (`Screensaver_calendar.html`)
  <img width="50%" height="50%" alt="Sample of Screensaver mode" src="https://github.com/user-attachments/assets/f1e06b4d-41a9-47b5-9af7-21a7cb8b7ebe" />

- Fullscreen clock/background/calendar mode
- Monthly/weekly background rotation
- Pictures are chosen from an dedicated folder path and can be replaced
- starts only if the button in the userbar is activated (so no absence detection or automation for this) 
    My personal usecase, i have guests over and i switch easily to a nice background picture and calendar and guest don't see my long list of overdue tasks, of whats on my shoppinglist. Not bulletproof as everyone can close this "screensaver" but deemed good enough for my partner and me for now.
    Especially if i have it on a public visible shared wall display (with kioskmode of the index_mainview.html which is a long term goal and reason i started this project as alternative existing solutions with supscription fees and so on)
  

## Weather Forecast
  <img width="50%" height="50%" alt="More detailed Weather forecast data" src="https://github.com/user-attachments/assets/89297386-a434-47ef-8d51-65ad8318c4b4" />
  
- Optional weather/rain display within extra popup, calendar views of the main board or screensaver.
- Weather integration has been tested so far with values from DWD integration entities in the `weather.<place>` format.
  - if the rain gauge in the screensaver works is still unclear. No Rain occured since idea and implementation. Need to wait out and see.
- `sun.sun` and `moon.moon_phases` are taken over from their corresponding Home Assistant integrations.

### Settings/Setup Options

- User definitions with names, roles, and avatar pictures.

- Settings per Home Assistant user.
- Quicknote configuration and editor behavior settings.
- Alerts: One device can be configured with `notify.*` and a time of day. This alert includes all tasks, independent of assignee, sorted by overdue time.

  <img width="50%" height="50%" alt="Screenshot of Setup input of the setting menu - Alerts" src="https://github.com/user-attachments/assets/5b35269d-a80b-4c10-b37b-2bf35d480bd4" />

  - There may be a delay between the configured time and when the alert appears on the device (assumed cause: processing time of the script that analyzes the full task list).
  - The list may be shortened due to alert display size limits and may include only a few entries.
  - Therefore, do not use this alert for time-critical tasks (for example, medicine reminders).
    
- Weather: configuration for dashboard/widgets.

  <img width="50%" height="50%" alt="Screenshot of Setup input of the setting menu - Weather" src="https://github.com/user-attachments/assets/c5c962cb-194f-4646-8abb-eb6768914196" />

  - Warning: weather behavior has been tested so far only with forecast data from DWD integration entities (`weather.<place>`).
   
- Optional calendar integrations, including icon selection and color picker support.

  <img width="50%" height="50%" alt="Screenshot of Setup input of the setting menu - Calender Integration 1" src="https://github.com/user-attachments/assets/ab8168ba-3257-4568-b634-ebee92f6a238" />
  <img width="50%" height="50%" alt="Screenshot of Setup input of the setting menu - Calender Integration 2" src="https://github.com/user-attachments/assets/e83711d7-697a-4491-b8da-334798f0fda6" />

- ScreenSaver - Editor what is shown:

  <img width="50%" height="50%" alt="Screenshot of Setup input of the setting menu - Screensaver" src="https://github.com/user-attachments/assets/df5f1f87-3034-4c88-b016-c1c73c2c667c" />

- Userbar Editor

  <img width="50%" height="50%" alt="Screenshot of Setup input of the setting menu - Userbar" src="https://github.com/user-attachments/assets/d58b17d9-9b23-4a41-82f1-a6fac6fbbe0d" />

  - Placement: top (default), bottom, left, right, and alignment.
  - Span or floating display.
  - Show text or icons only.
- Embedding custom Lovelace cards: see note below.
  
  <img width="50%" height="50%" alt="Screenshot of Setup input of the setting menu - custom user cards" src="https://github.com/user-attachments/assets/f512f247-4e66-47c8-86f2-ebfefcd2a649" />

- A visual pre-rendering mockup of the tile display helps detect overlays/mismatches.

  <img width="50%" height="50%" alt="Screenshot of Setup input of the setting menu - prerendering mockup of tilecard placing and sizes" src="https://github.com/user-attachments/assets/55587c25-c343-4ee5-985f-aa2297a07c0c" />


### Embedding Custom Lovelace Cards

For free custom Lovelace card embedding in the dashboard overview of `index_mainview.html`:

Status note (experimental):
- This applies to custom card linking in `index_mainview.html`, specifically in the Settings/Setup area where HA custom cards can be integrated.
- This linkage is currently experimental.
- Rendering and behavior do not necessarily match expectations from dedicated HA panel cards.
- Current tests show: some of those cards work well, some work partially, and some do not fully respect size boundaries.
- Reporting concrete examples and unexpected behavior/problems helps identify shared causes and supports root-cause analysis and issue fixing.

1. Install required custom cards via HACS.
2. Add each card JS under HA Dashboard Resources.

If resource is missing, UI shows:
- `Could not render card (custom element not registered: <tag>)`

## 4) First-Run Checklist

1. Open `/local/community/remeys_taskboard/index_mainview.html` (recommended with Website card)
2. Go to Settings:
- set up HA mapping (should auto-open on first use)
- define dashboard users with names and roles (later used for assignees and display filters)
- go through the options of the setup-tab
- configure what you want to use; do not forget to save each section with its corresponding save button
- add custom cards (optional)
- configure layout/panels for the display; check the mockup section in Setup for visual feedback
- save all changes before closing Settings
3. Configure `ha_auth.js` with a long-lived bearer token only if session-based auth is insufficient
4. Enable webhook backend if you want persistent saves from the UI
5. Start adding tasks.


## 5) Update Notes

- `usersettings/users.json` is seeded as an empty array for the first run.
- `usersettings/global.settings.json` is included as starter config.
- `notes.json` is included for quicknotes compatibility.
- Not or only partially compatible with earlier versions.
- Previously defined tasks in `data.updated.js` can be copied into `/userdata/tasklist.js`.
- Required migration change: replace `window.TABLE_DATA` with `window.PP_TASKS_DATA`.
- Previously defined user settings can be copied; missing data will be auto-corrected/prefilled with default values.
- Configuration in the Settings menu may need adjustment.

### NFC Tag Note (Mark Task Done)

Some users like using NFC tags to mark tasks as done. This is now a somewhat supported option.

Status:
- Not tested yet in this project (no NFC tag setup available in current testing environment).

General setup idea:
1. Define one HA automation trigger per NFC tag (for example: scanning tag `1234` triggers automation `X`).
2. In that automation, call `shell_command.taskboard_mark_done_task`.
3. Pass the `__uid` of the related task from the task list in the command template.

Where to find the `__uid`:
- Open the task in the editor; the `_uuid`/ID label is shown at the top of the popup editor form.

### Feature Requests

I am always open to feature requests:
- new features,
- display/layout suggestions,
- new behavior ideas (for example, drag-and-drop tasks in calendar views or zoom in the timetable of the family calender view - both originally suggested by my partner).

I am willing to review what is possible and what changes would be needed to implement a request.
However, I cannot guarantee implementation timelines or delivery.
This is a hobby project and part of an ongoing learning curve.

What is currently on my plate:
- In Family Calendar view, if many calendar events and 'tasks due times' overlap in the timetable, sorting/layering and visual display can become messy.
- This can be a useful indicator that a day needs special focus, but it is not a good design solution yet.
- I am researching options on better handling for this case.
