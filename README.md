This single-file web app (`index_language.html`) is a **Cleaning Schedule** UI that you host under Home Assistant’s `/config/www` and open via `/local/...`. It renders your tasks grouped by *Area*, calculates due dates, lets you **add/edit/delete** tasks, and can **persist** the updated table back into Home Assistant using a **webhook**. No external backend is required.

### Key features
- **Task dashboard**
  - Grouped by *Area* with collapsible sections
  - Cards show: Task, Frequency (days), Last done date, Next due date, and “Due in … days”
  - Click the task icon to mark *done* → updates dates to today and recalculates next due date
- **Sorting & filtering**
  - Sort by *due date* or *alphabetical*
  - Quick search over *Task* and *Area*
  - Time-range filter (e.g. overdue, next 3/5/7/14 days, all)
- **Add & edit dialogs**
  - Create new tasks or edit existing ones (fields: Area, Task, Frequency, Icon, Last done, Next due date, Importance)
  - Optional **Icon picker** using Iconify (supports `mdi:*`)
- **Theming**
  - Dark / Light / System theme toggle (remembers your choice)
- **Persistence**
  - Local, immediate changes are stored in `localStorage` as overrides
  - On changes (mark done / add / edit / delete) the app auto-generates a JS payload and sends it via **Home Assistant webhook** to write `data.updated.js` under `/config/www/...`
  - Script reloads with a cache-buster to reflect the new data without a full page refresh

### How it talks to Home Assistant
- Loads data from:
  - `/local/myownstuff/Putzplan/data.updated.js` → expected to define `window.TABLE_DATA = [...]`
- Writes data through webhook:
  - POST to `GET_HA_ORIGIN()/api/webhook/putzplan_export`
  - Body contains Base64 of the generated `window.TABLE_DATA = [...]` JS file
- A `shell_command` in `configuration.yaml` decodes and writes the file:
  ```yaml
  shell_command:
    putzplan_save: >-
      sh -c 'dir="/config/www/myownstuff/Putzplan";
      file="$dir/data.updated.js";
      mkdir -p "$dir";
      echo "{{ content_b64 }}" | base64 -d > "$file"'


How to make it work:

