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

Note:
-----
Files under `/config/www` are accessible at `/local/...` in Home Assistant.
The file must be named `index_language.html` (with underscore).

Installation
------------

1. Place the file
   Copy `index_(your language).html` into a subfolder of `/config/www`, for example:
   /config/www/myownstuff/Putzplan/index_language.html  (Putzplan means cleaning schedule in german, as i'm german)

2. Edit the file
   Open `index_(your language).html` in a text editor and adjust:

   - Line 156: Set your Home Assistant IP or URL:
     const HA_ORIGIN = "http://192.168.1.10:8123"; // adjust to your set up

   - Line 166: Point to your `data.updated.js` file:
     const abs = `${getHaOrigin()}/local/myownstuff/Putzplan/data.updated.js`; // adjust to your subfolder

   - Line 171 (optional): Change the webhook ID if desired: // if changed: remember the changed ID
     const WEBHOOK_ID = "putzplan_export";

   Example folder structure:
   /config/www/myownstuff/Putzplan/
   ├─ index_(your language).html
   └─ data.updated.js   (created later, automatically)

3. Add the following in your configuration.yaml (adjust the dir-folder if needed):

   shell_command:
     putzplan_save: >-
       sh -c 'dir="/config/www/myownstuff/Putzplan";
       file="$dir/data.updated.js";
       mkdir -p "$dir";
       echo "{{ content_b64 }}" | base64 -d > "$file"'

4. Update automations.yaml and Make sure webhook_id matches your HTML file:

   - alias: "Webhook: putzplan_export"
     trigger:
       - platform: webhook
         webhook_id: putzplan_export
     action:
       - service: shell_command.putzplan_save
         data:
           filename: "{{ trigger.json.filename }}"
           content_b64: "{{ trigger.json.content_b64 }}"

5. Restart Home Assistant
   - Go to Settings → System → Restart or reload Automations/Shell Commands if available.
   - Validate your YAML before restarting.

Access
------
Open in a browser:  http://<YOUR_HA_IP>:8123/local/myownstuff/Putzplan/index_language.html
Or use an iframe card with this URL: e.g. "/local/myownstuff/Putzplan/index_en.html"



Testing
-------
- The page should load.
- Changes (new tasks, edit task, erase task, checked tasks) triggers the webhook.
- data.updated.js will be created/updated in the target folder.

<img alt="Cleaning_schedule_start" src="https://github.com/user-attachments/assets/08982913-bf30-4062-b084-eeeb10b8c171" />
