This single-file web app (`index_language.html`) is a **Cleaning Schedule** UI that you host under Home Assistant’s `/config/www` and open via `/local/...`. It renders your tasks grouped by *Area*, calculates due dates, lets you **add/edit/delete** tasks, and can **persist** the updated table back into Home Assistant using a **webhook**. No external backend is required.

### Key features
- **Task dashboard**
  - Grouped by *Area* with collapsible sections
  - Cards show: Task, Frequency (days, weeks, months), Last done date, Next due date, and “Due in … days”
  - Click the task icon to mark *done* → updates dates to today and recalculates next due date
- **Sorting & filtering**
  - Sort by *due date* or *alphabetical*
  - Quick search over *Task* and *Area*
  - Time-range filter (e.g. overdue, next 3/5/7/14 days, all)
- **Add & edit dialogs**
  - Create new tasks or edit existing ones (fields: Area, Task, Frequency, Icon, Last done, Next due date)
  - Task rhythms can be defined in days, weeks, or months
  - Per-task month rules:
    - Ignore months entirely, or
    - Restrict execution to selected months
  - Editing a task recalculates all due dates automatically using the current rules
  - Tasks can be edited at any time; rule changes are applied automatically
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
    ```
- And in automation.yaml 
    ```yaml
    - alias: "Webhook: putzplan_export"
    trigger:
      - platform: webhook
        webhook_id: putzplan_export
    action:
      - service: shell_command.putzplan_save
        data:
          filename: "{{ trigger.json.filename }}"
          content_b64: "{{ trigger.json.content_b64 }}"
    ```

Note:
-----
Files under `/config/www` are accessible at `/local/...` in Home Assistant.
The file must be named `index_language.html` (with underscore).

Installation
------------

1. Place the file
   Copy `index_language.html` into a subfolder of `/config/www`, for example:
   
   /config/www/myownstuff/Putzplan/index_language.html
   (Putzplan means cleaning schedule in german, as i'm german)

3. Edit the file
   Open `index_language.html` in a text editor and adjust:
   
   - Line 226: Point to your `data.updated.js` file:
     window.BASE_PATH = "/local/myownstuff/Putzplan/"; // adjust to your subfolder
     
   - Line 229: Set your Home Assistant IP or URL:
     window.HA_ORIGIN = 'http://192.168.178.38:8123'; // adjust to your set up

   - Line 237 (optional): Change the webhook ID if desired: // if changed: remember the changed ID
     const webhookUrl = `${getHaOrigin()}/api/webhook/putzplan_export`;

   Example folder structure:
   /config/www/myownstuff/Putzplan/
   ├─ index_language.html
   └─ data.updated.js   (created later, automatically)

4. Add the following in your `configuration.yaml` (adjust the dir-folder if needed):
    ```yaml
    shell_command:
      putzplan_save: >-
        sh -c 'dir="/config/www/myownstuff/Putzplan";
        file="$dir/data.updated.js";
        mkdir -p "$dir";
        echo "{{ content_b64 }}" | base64 -d > "$file"'
    ```

5. Update automations.yaml and Make sure webhook_id matches  with the webhhok_id in the HTML file:
    ```yaml
    - alias: "Webhook: putzplan_export"
    trigger:
      - platform: webhook
        webhook_id: putzplan_export
    action:
      - service: shell_command.putzplan_save
        data:
          filename: "{{ trigger.json.filename }}"
          content_b64: "{{ trigger.json.content_b64 }}"
    ```

6. Restart Home Assistant
   - Go to Settings → System → Restart or reload Automations/Shell Commands if available.
   - Validate your YAML before restarting.

Access
------
Open in a browser:  http://<YOUR_HA_IP>:8123/local/myownstuff/Putzplan/index_language.html
Or use an iframe card with this URL: e.g. "/local/myownstuff/Putzplan/index_language.html"



Testing
-------
- The page should load.
- Changes (new tasks, edit task, erase task, checked tasks) triggers the webhook.
- data.updated.js will be created/updated in the target folder.

<img width="617" height="822" alt="GUI: add/edit Tasks " src="https://github.com/user-attachments/assets/97af3b14-57ca-4b33-939c-c0b1b823ddb8" />
<img width="1762" height="896" alt="My setup example" src="https://github.com/user-attachments/assets/b8831cad-8a61-4393-8d02-7ff24496ac60" />


##Beta Version Preview
-------
- Customizable CSS Design with GUI and Colorpicker, still some manual steps are needed (only in english)
- HA- Sensor is used as indicator for tasks state (due/done) by text/number rules (single Sensor only)
- warning if Sensor doesn't exists, Colored Highlight of whole card color (default: red) in the dashboard
- warning if Sensor State is in conflict with due/done-ruling or not avaiable; Colored Highlight of whole card color (default: light purple) in the dashboard
- friendly sensor name, value and unit are displayed within task-card
- done: check if ruling definition is not in conflict with itself (alert to user)
- Normalizing sensor state strings: Trailing spaces and case variations in sensor states are now automatically handled. For example, values like "On", "on", "ON", "true", "TRUE", "True", "true " are treated as equivalent, as well as "off", "Off", "OFF", "False", "FALSE", and "false".  
- pending (not yet implied): sorting issues of tasks by due-done order and warning-state

<img width="992" height="909" alt="View of new css-style GUI" src="https://github.com/user-attachments/assets/37ad066f-9605-44f4-bbe3-ceff97c3c6fb" />
<img width="1555" height="344" alt="Example of new task card of SensorReading" src="https://github.com/user-attachments/assets/abb5d603-dfce-40e9-87dc-f9d8d9689815" />
<img width="762" height="353" alt="Snippet of the task-editor with sensor and ruling example" src="https://github.com/user-attachments/assets/821e753a-df23-4ef8-94d4-a6a9d1548ed2" />




