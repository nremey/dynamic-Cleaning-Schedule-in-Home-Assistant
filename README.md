# Choreboard / Cleaning Schedule (Version 2) - Overview

This single-file web app (`index_taskboard.html`) is a task board for cleaning and household chores in Home Assistant.  
It is hosted under `/config/www` and opened via `/local/...`.  
Task changes can be stored locally and optionally written back to Home Assistant via webhook (`data.updated.js`).

## Version 2.0 note:  
The newest release is inside `remeys_choreboard.zip`. Installation steps are provided in `README_english.md` and `README_german.md` within the ZIP.

<img width="1530" height="813" alt="Impression Version 2" src="https://github.com/user-attachments/assets/f0282135-6c23-4e68-a418-a1446370536a" />
Impression with displayed Quick Notes and public holidays within the calendar view. 


## Core Features

- Task dashboard grouped by Area with collapsible sections and due-date logic
- Mark tasks as done (sets date to today and recalculates)
- Sorting and filtering:
  - by due date or alphabetical order
  - search across Task and Area
  - time filters (overdue, next X days, all)
- Add, edit, and delete tasks
- Frequencies in days, weeks, or months
- Per-task month rules:
  - ignore specific months or restrict to selected months
- Optional icon picker (Iconify, including `mdi:*`)
- Theme switching: Dark / Light / System
- Automatic synchronization through Home Assistant webhook with cache-buster reload
- HA sensor integration (one sensor per task as due/done indicator)
  - warning if sensor is missing
  - warning on rule conflicts
  - sensor friendly name, value, and unit shown on task cards
  - normalization of sensor state strings (e.g. `On/on/true/true `)
- Calendar views (week, month, list)
  - navigation and separate overdue sidebar
  - drag and drop tasks between calendar days (updates due date)

## User Management and Personalization

- Create, edit, and delete users
- Profile fields: name, role, stars, motto, avatar
- Switch active user via user bar
- Optional task assignees:
  - visibility by user, role, and mapped group
  - assignment suggestions/autocomplete
- Home Assistant user mapping:
  - mapping between HA users and internal users
  - optional role/group filter
- Card metadata:
  - "Last done by"
  - assignees shown directly on cards for admins (admin sees all tasks no matter the Assignee)
- Per-user theme:
  - custom colors/CSS per user
  - stored under `usersettings/`

## Additional Enhancements

- Automatic runtime path detection (`BASE_PATH`, `HA_ORIGIN`, etc.), no manual HTML path setup required
- Optional panels:
  - Quick Notes (shared across users)
  - External Home Assistant calendar events
- Quick Notes include a small rich-text editor (e.g. bold, italic, list, font size)
- Task visualization:
  - progress gauge as ring or bar
  - overdue cycles displayed as `+N`
  - history as heatmap or timeline (configurable per user)
- UI/settings updates:
  - "User Management" renamed to "Settings"
  - tabs reorganized (User / Setup / Display)
  - improved icon selection
  - paperclip indicator for task notes (hit the paperclip and the Note of the task is shown)
  - small usability and layout improvements


## Known issues (to be addressed in upcoming versions):
- The calendar view (week and month) looks poor on small screens. There’s no nicer way to put it. Open to suggestions.
- Having many tasks — either in the overdue section or grouped within a single day — can distort the month layout. It’s unclear whether this is primarily a layout limitation or simply an edge case caused by an excessive number of overdue tasks (not that this would ever happen to me, of course 😉).
- Open issue since v1.2: sorting for sensor-indicated tasks by due/done/warning is not fully resolved



# Some Impressions

<img width="615" height="907" alt="TaskEditor" src="https://github.com/user-attachments/assets/eeeaeed0-a048-460e-b8cf-ebe4bc85a54b" />

<img width="796" height="771" alt="Usermanagement" src="https://github.com/user-attachments/assets/058a6a0a-c646-4fdb-a691-38cf8e41d382" />

<img width="796" height="771" alt="Theme-Editor per User" src="https://github.com/user-attachments/assets/14caf19c-f764-4f4b-a950-7e4e1e842508" />

<img width="1548" height="884" alt="Taskboard View: grouped Tasks" src="https://github.com/user-attachments/assets/ea9bccba-408c-4b45-9b5a-5d6f9bc3354f" />

<img width="783" height="789" alt="Taskboard View: Calendar (list) - better for small displays" src="https://github.com/user-attachments/assets/46360701-48e1-40b3-b47b-95235c1b6ab7" />

<img width="1522" height="863" alt="Snippet of: Taskboard View: Calendar (month) - better for bigger displays" src="https://github.com/user-attachments/assets/01a07370-53a4-4df2-a879-5ebc9ee43d3c" />

<img width="1548" height="884" alt="Taskboard View: grouped Tasks (Theme changed as activ User changed)" src="https://github.com/user-attachments/assets/1f5c1453-d431-436a-b354-a73f927ade4b" />



<img width="1555" height="344" alt="Examples of the task card when HA-Enitity are use as State Indicator" src="https://github.com/user-attachments/assets/abb5d603-dfce-40e9-87dc-f9d8d9689815" />

<img width="762" height="353" alt="Examples of the TaskEditor when HA-Enitity are defined as State Indicator" src="https://github.com/user-attachments/assets/821e753a-df23-4ef8-94d4-a6a9d1548ed2" />

