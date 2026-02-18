This single-file web app (`index_language.html`) is a **Cleaning Schedule** UI that you host under Home Assistant’s `/config/www` and open via `/local/...`. It renders your tasks grouped by *Area*, calculates due dates, lets you **add/edit/delete** tasks, and can **persist** the updated table back into Home Assistant using a **webhook**. No external backend is required.

### Newest Version 2.0 is in the remeys_choreboard.zip,  
further installation steps are put in the README_english.md and README_german.md within the zip.

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


Installation (till Version 1.4)
------------

1. Place the file
   Copy `index_language.html` into a subfolder of `/config/www`, for example:
   
   /config/www/myownstuff/Putzplan/index_language.html
   (Putzplan means cleaning schedule in german, as i'm german)

2. Edit the file
   Open `index_language_<versionnumber>.html` in a text editor and adjust:
   
   - Line 9: Point to your `data.updated.js` file:
     window.BASE_PATH = "/local/myownstuff/Putzplan/"; // adjust to your subfolder
     
   - Line 12: Set your Home Assistant IP or URL:
     window.HA_ORIGIN = 'http://192.168.178.38:8123'; // adjust to your set up

   - Line 20 (optional): Change the webhook ID if desired: // if changed: remember the changed ID
     const webhookUrl = `${getHaOrigin()}/api/webhook/putzplan_export`;

   Example folder structure:
   /config/www/myownstuff/Putzplan/
   ├─ index_language.html
   └─ data.updated.js   (created later, automatically)

3. Add the following in your `configuration.yaml` (adjust the dir-folder if needed):
    ```yaml
    shell_command:
      putzplan_save: >-
        sh -c 'dir="/config/www/myownstuff/Putzplan";
        file="$dir/data.updated.js";
        mkdir -p "$dir";
        echo "{{ content_b64 }}" | base64 -d > "$file"'
    ```

4. Update automations.yaml and Make sure webhook_id matches  with the webhhok_id in the HTML file:
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

5. Restart Home Assistant
   - Go to Settings → System → Restart or reload Automations/Shell Commands if available.
   - Validate your YAML before restarting.


Installation (since Version 1.6)
------------

1. Place the file
   Copy `index_<version>.html` into a subfolder of `/config/www`, for example:
   
   `/config/www/myownstuff/Putzplan/index_<version>.html`
   (Putzplan means cleaning schedule in german, as i'm german)

2. Edit the file
   Open `index_<versionnumber>.html` in a text editor and adjust:
   
   - Line 9 and 10: Point to your `index_<versionnumber>.html` file:
   	 	window.BASE_PATH = "/local/myownstuff/Putzplan/"; // adjust to your subfolder (keep the /local/-part)
   	 	window.PP_FILE_SAVE_DIR = 	'/config/www/myownstuff/Putzplan'; // adjust to your subfolder (keep the /config/www/-part)

   - Line 11: Set your Home Assistant IP or URL:
     	window.HA_ORIGIN = 'http://192.168.178.38:8123'; // adjust to your set up

   - Line 23 (optional): Change the webhook ID if desired: // if changed: remember the changed ID
     	const webhookUrl = `${getHaOrigin()}/api/webhook/putzplan_textcontentfile_export`;

3. Create a subfolder manually: `usersettings`

   Example folder structure:
   /config/www/myownstuff/Putzplan/
   ├─ index_<version>.html
   ├─ usersettings		(may be filled later, if users are defined)
   └─ data.updated.js   (created later, automatically)

3. Add the following in your `configuration.yaml` (the shell_command as in the instruction for former versions aren't required anymore, delete or replace):
    ```yaml
    shell_command:
      putzplan_save: >-
        sh -c 'dir="{{path}}";
        file="$dir/{{filename}}";
        mkdir -p "$dir";
        echo "{{ content_b64 }}" | base64 -d > "$file"'
    ```

4. Update automations.yaml and Make sure webhook_id matches  with the webhhok_id in the HTML file:
    ```yaml
    - alias: "Webhook: putzplan_file_export"
    trigger:
      - platform: webhook
        webhook_id: putzplan_textcontentfile_export
    action:
      - service: shell_command.putzplan_textcontentfile_save
        data:
          path: "{{ trigger.json.savingpath }}"
          filename: "{{ trigger.json.filename }}"
          content_b64: "{{ trigger.json.content_b64 }}"
    ```

5. Restart Home Assistant
   - Go to Settings → System → Restart or reload Automations/Shell Commands if available.
   - Validate your YAML before restarting.
     
6. If replacing a former version, it is neccesary to Clean Cache of Browser or Companion App of used devices.

Access
------
Open in a browser:  http://<YOUR_HA_IP>:8123/local/myownstuff/Putzplan/index_<version>.html
Or use an iframe card with this URL: e.g. "/local/myownstuff/Putzplan/index_<version>.html"


Testing
-------
- The page should load.
- Changes (new tasks, edit task, erase task, checked tasks) triggers the webhook and saves data in files.
- data.updated.js will be created/updated in the target folder.


<img width="615" height="907" alt="GUI: add/edit Tasks" src="https://github.com/user-attachments/assets/eeeaeed0-a048-460e-b8cf-ebe4bc85a54b" />

<img width="796" height="771" alt="User management" src="https://github.com/user-attachments/assets/058a6a0a-c646-4fdb-a691-38cf8e41d382" />

<img width="796" height="771" alt="Theme Editor per User" src="https://github.com/user-attachments/assets/14caf19c-f764-4f4b-a950-7e4e1e842508" />

<img width="1548" height="884" alt="Task collection (admin - view)" src="https://github.com/user-attachments/assets/ea9bccba-408c-4b45-9b5a-5d6f9bc3354f" />

<img width="1548" height="884" alt="Task collection (normal - view)" src="https://github.com/user-attachments/assets/1f5c1453-d431-436a-b354-a73f927ade4b" />

<img width="1555" height="344" alt="Example of new task card of SensorReading" src="https://github.com/user-attachments/assets/abb5d603-dfce-40e9-87dc-f9d8d9689815" />

<img width="762" height="353" alt="Snippet of the task-editor with sensor and ruling example" src="https://github.com/user-attachments/assets/821e753a-df23-4ef8-94d4-a6a9d1548ed2" />

<img width="1531" height="781" alt="view Calendar week" src="https://github.com/user-attachments/assets/44380fb3-5a8d-4c4a-a710-001464a116d3" />

<img width="783" height="789" alt="view Calendar list" src="https://github.com/user-attachments/assets/46360701-48e1-40b3-b47b-95235c1b6ab7" />


## As of Version 1.6
-------
- HA-Sensor is used as indicator for tasks state (due/done) by text/number rules (single Sensor only)
	- warning if Sensor doesn't exists, Colored Highlight of whole card color (default: red) in the dashboard
	- warning if Sensor State is in conflict with due/done-ruling or not avaiable; Colored Highlight of whole card color (default: light purple) in the dashboard
	- friendly sensor name, value and unit are displayed within task-card
	- done: check if ruling definition is not in conflict with itself (alert to user)
	- Normalizing sensor state strings: Trailing spaces and case variations in sensor states are now automatically handled. For example, values like "On", "on", "ON", "true", "TRUE", "True", "true " are treated as equivalent, as well as "off", "Off", "OFF", "False", "FALSE", and "false".  
	- pending (not yet implied): sorting issues of tasks by due-done order and warning-state
- Added calendar week/month/list views with navigation and overdue sidebar in calendar layout.
	- Calendar week/month view (not recommended on small screens):
	- view ignores range (days) filter; overdue items are listed separately.
	- Calendar items are compact, no visuell overload.
	- Enabled drag-and-drop to move tasks between calendar days (updates due date).
- Added fixed weekdays (WeekMask) for tasks; recalculation shifts to the next allowed weekday (combined with month rules).
- Unified debounced exports and added a sync status indicator.
- Clear task cache on reload while keeping header preferences (view/filter/etc.).

- User Management is possible.
	- New user management UI to create, edit, and delete users.
	- User profile fields: name, role, stars, motto, avatar.
	- Active user switching via user bar.
	- optional Task Assignees
		- New Assignee field in add/edit task dialogs.
 		- Assignee-aware task visibility (by user, role, and mapped group).
  		- Assignee suggestions/autocomplete from known users/roles/groups.
	- HA User Mapping
		- Mapping between Home Assistant users and internal users.
 		- Optional role/group filter per mapping.
  		- Mapping tab and list in user management dialog.
	- Card-Level Metadata
		- Task cards now show Last done by.
 		- Admin users now see assignees directly on task cards.
  		- Multiple assignees are displayed as separate pills.
	- Per-User Theme
 		- Customizable CSS Design via Colorpicker (only in english) 
		- Saves User-specific theme files under usersettings/.
 		- Theme loading tied to active user context.



## Known issues (to be addressed in upcoming versions):
- The calendar view (week and month) looks poor on small screens. There’s no nicer way to put it. Open to suggestions.
- Having many tasks — either in the overdue section or grouped within a single day — can distort the month layout. It’s unclear whether this is primarily a layout limitation or simply an edge case caused by an excessive number of overdue tasks (not that this would ever happen to me, of course 😉).
- from version 1.2 pending (still not yet implied): sorting issues of HA-Sensor state indicated tasks by due-done order and warning-state

