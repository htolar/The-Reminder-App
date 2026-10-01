'use strict';

const STORAGE_KEY = 'reminder-app.state.v4';

const state = {
  tasks: [],
  selectedTaskId: null,
  grindMode: false,
  grindTaskIds: [],
  grindTotalUnits: 0,
  grindCurrentId: null,
  grindTimerSeconds: 0,
  grindTimerId: null,
  settingsOpen: false,
  editingSites: false,
  settingsSites: [],
  checkInMinutes: 60,
};

const elements = {};

/* =========================================================
   SETTINGS FALLBACKS
   The real versions come from options/settings.js.
   These fallbacks keep the main app from crashing if that
   file is unavailable for some reason.
   ========================================================= */

const FALLBACK_SETTINGS_KEY = 'reminder-app.settings.v2';

const FALLBACK_SITES = [
  { host: '*game', mode: 'block' },
  { host: '*unblocked', mode: 'block' },
  { host: 'poki.com', mode: 'block' },
  { host: 'crazygames.com', mode: 'block' },
  { host: 'miniclip.com', mode: 'block' },
  { host: 'y8.com', mode: 'block' },
  { host: 'roblox.com', mode: 'block' },
  { host: 'steampowered.com', mode: 'block' },
  { host: 'epicgames.com', mode: 'block' },
  { host: 'youtube.com', mode: 'checkin' },
  { host: 'reddit.com', mode: 'checkin' },
  { host: 'twitch.tv', mode: 'checkin' },
  { host: 'netflix.com', mode: 'checkin' },
  { host: 'tiktok.com', mode: 'checkin' },
  { host: 'instagram.com', mode: 'checkin' },
];

async function safeGetSettings() {
  if (typeof getSettings === 'function') {
    try {
      return await getSettings();
    } catch (error) {
      console.warn('getSettings failed, using fallback settings.', error);
    }
  }

  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage?.local
    ) {
      const saved = await chrome.storage.local.get([
        'sites',
        'checkInMinutes',
      ]);

      return {
        sites: Array.isArray(saved.sites)
          ? saved.sites
          : FALLBACK_SITES,
        checkInMinutes:
          Number(saved.checkInMinutes) > 0
            ? Number(saved.checkInMinutes)
            : 60,
      };
    }

    const saved = JSON.parse(
      localStorage.getItem(FALLBACK_SETTINGS_KEY) || '{}'
    );

    return {
      sites: Array.isArray(saved.sites)
        ? saved.sites
        : FALLBACK_SITES,
      checkInMinutes:
        Number(saved.checkInMinutes) > 0
          ? Number(saved.checkInMinutes)
          : 60,
    };
  } catch {
    return {
      sites: [...FALLBACK_SITES],
      checkInMinutes: 60,
    };
  }
}

async function safeSaveSettings(settings) {
  if (typeof saveSettings === 'function') {
    try {
      await saveSettings(settings);
      return;
    } catch (error) {
      console.warn(
        'saveSettings failed, using fallback storage.',
        error
      );
    }
  }

  const payload = {
    sites: settings.sites,
    checkInMinutes: settings.checkInMinutes,
  };

  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage?.local
    ) {
      await chrome.storage.local.set(payload);
    } else {
      localStorage.setItem(
        FALLBACK_SETTINGS_KEY,
        JSON.stringify(payload)
      );
    }
  } catch (error) {
    console.error('Could not save settings.', error);
  }
}

async function safeResetSettings() {
  if (typeof resetSettings === 'function') {
    try {
      await resetSettings();
      return;
    } catch (error) {
      console.warn(
        'resetSettings failed, using fallback storage.',
        error
      );
    }
  }

  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage?.local
    ) {
      await chrome.storage.local.remove([
        'sites',
        'checkInMinutes',
      ]);
    } else {
      localStorage.removeItem(FALLBACK_SETTINGS_KEY);
    }
  } catch (error) {
    console.error('Could not reset settings.', error);
  }
}

/* =========================================================
   ELEMENTS
   ========================================================= */

function cacheElements() {
  const ids = [
    'settings-btn',
    'help-btn',
    'settings-panel',
    'settings-notice',
    'checkin-minutes',
    'sites-list',
    'editor-mode-btn',
    'add-site-form',
    'add-site-host',
    'add-site-block',
    'settings-save',
    'settings-reset',
    'settings-close',
    'settings-status',

    'task-form',
    'task-name',
    'task-duration',
    'task-list',

    'grind-board',
    'back-to-home-btn',
    'grind-task-name',
    'grind-checklist',
    'grind-timer',
    'grind-pause-btn',
    'grind-reset-btn',
    'grind-extend-btn',
    'grind-progress-percent',
    'grind-progress-fill',
    'grind-button',
    'start-grind-btn',

    'subtask-menu',
    'close-subtask-menu',
    'subtask-parent-name',
    'subtask-form',
    'subtask-name',
    'subtask-duration',
  ];

  for (const id of ids) {
    const camelKey = id.replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );

    elements[camelKey] = document.getElementById(id);
  }

  elements.taskPanel =
    document.querySelector('.task-panel');

  elements.listPanel =
    document.querySelector('.list-panel');

  elements.appShell =
    document.querySelector('.app-shell');
}

/* =========================================================
   STORAGE
   ========================================================= */

async function storageGet(key) {
  if (
    typeof chrome !== 'undefined' &&
    chrome.storage?.local
  ) {
    return chrome.storage.local.get(key);
  }

  try {
    return JSON.parse(
      localStorage.getItem(key) || '{}'
    );
  } catch {
    return {};
  }
}

async function storageSet(value) {
  if (
    typeof chrome !== 'undefined' &&
    chrome.storage?.local
  ) {
    return chrome.storage.local.set(value);
  }

  for (
    const [key, data] of Object.entries(value)
  ) {
    localStorage.setItem(
      key,
      JSON.stringify(data)
    );
  }
}

/* =========================================================
   HELPERS
   ========================================================= */

function uid(prefix = 'task') {
  return (
    prefix +
    '-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

function clampNumber(
  value,
  min,
  max,
  fallback
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(
    min,
    Math.min(max, number)
  );
}

function formatTime(seconds) {
  const total =
    Math.max(0, Math.floor(seconds));

  const minutes =
    Math.floor(total / 60);

  const remaining =
    total % 60;

  return (
    String(minutes).padStart(2, '0') +
    ':' +
    String(remaining).padStart(2, '0')
  );
}

function makeButton(
  text,
  className = ''
) {
  const button =
    document.createElement('button');

  button.type = 'button';
  button.textContent = text;

  if (className) {
    button.className = className;
  }

  return button;
}

/* =========================================================
   TASK NORMALIZATION
   ========================================================= */

function normalizeSubtask(subtask) {
  return {
    id:
      String(
        subtask?.id ||
        uid('subtask')
      ),

    title:
      String(
        subtask?.title ||
        'Mini task'
      ).trim() ||
      'Mini task',

    minutes:
      clampNumber(
        subtask?.minutes,
        1,
        180,
        5
      ),

    completed:
      Boolean(subtask?.completed),
  };
}

function normalizeTask(task) {
  return {
    id:
      String(
        task?.id ||
        uid()
      ),

    title:
      String(
        task?.title ||
        'Untitled task'
      ).trim() ||
      'Untitled task',

    minutes:
      clampNumber(
        task?.minutes,
        1,
        180,
        25
      ),

    completed:
      Boolean(task?.completed),

    subtasks:
      Array.isArray(task?.subtasks)
        ? task.subtasks.map(
            normalizeSubtask
          )
        : [],
  };
}

/* =========================================================
   APP STATE
   ========================================================= */

async function loadState() {
  const saved =
    await storageGet(STORAGE_KEY);

  const data =
    saved?.[STORAGE_KEY] || {};

  state.tasks =
    Array.isArray(data.tasks)
      ? data.tasks.map(
          normalizeTask
        )
      : [];

  state.selectedTaskId =
    data.selectedTaskId &&
    state.tasks.some(
      task =>
        task.id ===
        data.selectedTaskId
    )
      ? data.selectedTaskId
      : state.tasks[0]?.id ||
        null;

  state.grindMode =
    Boolean(
      data.grindMode &&
      state.tasks.length
    );

  state.grindTaskIds =
    Array.isArray(
      data.grindTaskIds
    )
      ? data.grindTaskIds.filter(
          id =>
            state.tasks.some(
              task =>
                task.id === id
            )
        )
      : state.tasks.map(
          task => task.id
        );

  state.grindCurrentId =
    data.grindCurrentId &&
    state.tasks.some(
      task =>
        task.id ===
        data.grindCurrentId
    )
      ? data.grindCurrentId
      : null;

  state.grindTimerSeconds =
    Math.max(
      0,
      Number(
        data.grindTimerSeconds
      ) || 0
    );
}

async function saveState() {
  await storageSet({
    [STORAGE_KEY]: {
      tasks: state.tasks,
      selectedTaskId:
        state.selectedTaskId,

      grindMode:
        state.grindMode,

      grindTaskIds:
        state.grindTaskIds,

      grindCurrentId:
        state.grindCurrentId,

      grindTimerSeconds:
        state.grindTimerSeconds,
    },
  });
}

/* =========================================================
   TASK LOOKUPS
   ========================================================= */

function findTaskNode(id) {
  return (
    state.tasks.find(
      task => task.id === id
    ) || null
  );
}

function getSessionTasks() {
  return state.grindTaskIds
    .map(findTaskNode)
    .filter(Boolean);
}

function getCurrentGrindTask() {
  if (state.grindCurrentId) {
    const current =
      findTaskNode(
        state.grindCurrentId
      );

    if (
      current &&
      !current.completed
    ) {
      return current;
    }
  }

  return (
    getSessionTasks().find(
      task => !task.completed
    ) || null
  );
}

function countUnits(task) {
  return (
    1 +
    task.subtasks.length
  );
}

function countCompletedUnits(task) {
  return (
    (task.completed ? 1 : 0) +
    task.subtasks.filter(
      subtask =>
        subtask.completed
    ).length
  );
}

function calculateProgress() {
  const total =
    state.grindTotalUnits;

  if (!total) {
    return 0;
  }

  const remaining =
    getSessionTasks().reduce(
      (sum, task) =>
        sum + countUnits(task),
      0
    );

  const completed =
    total - remaining;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (completed / total) *
          100
      )
    )
  );
}

/* =========================================================
   TASK LIST RENDER
   ========================================================= */

function renderTaskList() {
  elements.taskList.innerHTML =
    '';

  if (!state.tasks.length) {
    const empty =
      document.createElement('li');

    empty.className =
      'empty-state';

    empty.textContent =
      'No tasks yet. Add one above.';

    elements.taskList.appendChild(
      empty
    );

    return;
  }

  for (
    const task of state.tasks
  ) {
    const li =
      document.createElement('li');

    li.className =
      'task-item' +
      (
        task.id ===
        state.selectedTaskId
          ? ' selected'
          : ''
      ) +
      (
        task.completed
          ? ' completed'
          : ''
      );

    const select =
      makeButton(
        task.completed
          ? '✓ ' + task.title
          : task.title,
        'task-select'
      );

    select.addEventListener(
      'click',
      async () => {
        state.selectedTaskId =
          task.id;

        await saveState();

        renderTaskList();
      }
    );

    const right =
      document.createElement(
        'div'
      );

    right.className =
      'task-actions';

    const duration =
      document.createElement(
        'span'
      );

    duration.className =
      'task-duration';

    duration.textContent =
      task.minutes + ' min';

    const mini =
      makeButton('+ mini');

    mini.addEventListener(
      'click',
      () =>
        openSubtaskMenu(task)
    );

    const deleteButton =
      makeButton('×');

    deleteButton.className =
      'task-delete';

    deleteButton.title =
      'Delete task';

    deleteButton.addEventListener(
      'click',
      () =>
        deleteTask(task.id)
    );

    right.append(
      duration,
      mini,
      deleteButton
    );

    li.append(
      select,
      right
    );

    if (
      task.subtasks.length
    ) {
      const details =
        document.createElement(
          'details'
        );

      details.className =
        'subtask-details';

      const summary =
        document.createElement(
          'summary'
        );

      summary.textContent =
        task.subtasks.length +
        ' mini task' +
        (
          task.subtasks.length ===
          1
            ? ''
            : 's'
        );

      details.appendChild(
        summary
      );

      const list =
        document.createElement(
          'ul'
        );

      list.className =
        'subtask-list';

      task.subtasks.forEach(
        subtask => {
          const subLi =
            document.createElement(
              'li'
            );

          subLi.textContent =
            (
              subtask.completed
                ? '✓ '
                : ''
            ) +
            subtask.title +
            ' — ' +
            subtask.minutes +
            ' min';

          list.appendChild(
            subLi
          );
        }
      );

      details.appendChild(
        list
      );

      li.appendChild(
        details
      );
    }

    elements.taskList.appendChild(
      li
    );
  }
}

/* =========================================================
   GRIND CHECKLIST
   ========================================================= */

function renderGrindChecklist(
  activeTask
) {
  elements.grindChecklist.innerHTML =
    '';

  const tasks =
    getSessionTasks();

  if (!tasks.length) {
    const empty =
      document.createElement(
        'p'
      );

    empty.className =
      'empty-state';

    empty.textContent =
      'No tasks in this GRIND session.';

    elements.grindChecklist.appendChild(
      empty
    );

    return;
  }

  tasks.forEach(task => {
    const group =
      document.createElement(
        'div'
      );

    group.className =
      'grind-task-group' +
      (
        task.id === activeTask?.id
          ? ' active'
          : ''
      ) +
      (
        task.completed
          ? ' done'
          : ''
      );

    const mainRow =
      document.createElement(
        'label'
      );

    mainRow.className =
      'check-item' +
      (
        task.completed
          ? ' done'
          : ''
      );

    const checkbox =
      document.createElement(
        'input'
      );

    checkbox.type =
      'checkbox';

    checkbox.checked =
      task.completed;

    checkbox.addEventListener(
      'change',
      async () => {
        if (
          checkbox.checked
        ) {
          await deleteTask(
            task.id
          );
        }
      }
    );

    const title =
      document.createElement(
        'span'
      );

    title.className =
      'grind-item-title';

    title.textContent =
      task.title +
      ' — ' +
      task.minutes +
      ' min';

    mainRow.append(
      title,
      checkbox
    );

    group.appendChild(
      mainRow
    );

    if (
      task.subtasks.length
    ) {
      const subList =
        document.createElement(
          'ul'
        );

      subList.className =
        'grind-subtask-list';

      task.subtasks.forEach(
        subtask => {
          const row =
            document.createElement(
              'li'
            );

          row.className =
            'grind-subtask-item' +
            (
              subtask.completed
                ? ' done'
                : ''
            );

          const subCheck =
            document.createElement(
              'input'
            );

          subCheck.type =
            'checkbox';

          subCheck.checked =
            subtask.completed;

          subCheck.addEventListener(
            'change',
            async () => {
              if (
                !subCheck.checked
              ) {
                return;
              }

              const subIndex =
                task.subtasks.findIndex(
                  s =>
                    s.id ===
                    subtask.id
                );

              if (
                subIndex !==
                -1
              ) {
                task.subtasks.splice(
                  subIndex,
                  1
                );
              }

              await saveState();

              renderAll();
            }
          );

          const subTitle =
            document.createElement(
              'span'
            );

          subTitle.className =
            'grind-item-title';

          subTitle.textContent =
            subtask.title +
            ' — ' +
            subtask.minutes +
            ' min';

          row.append(
            subTitle,
            subCheck
          );

          subList.appendChild(
            row
          );
        }
      );

      group.appendChild(
        subList
      );
    }

    elements.grindChecklist.appendChild(
      group
    );
  });
}

/* =========================================================
   PROGRESS BAR
   ========================================================= */

function renderProgress() {
  const percent =
    calculateProgress();

  elements.grindProgressPercent.textContent =
    percent + '%';

  elements.grindProgressFill.style.width =
    percent + '%';

  elements.grindProgressFill.setAttribute(
    'aria-valuenow',
    String(percent)
  );
}

/* =========================================================
   GRIND BOARD
   ========================================================= */

function renderGrindBoard() {
  if (!state.grindMode) {
    elements.grindBoard.classList.add(
      'hidden'
    );

    elements.taskPanel.classList.remove(
      'hidden'
    );

    elements.listPanel.classList.remove(
      'hidden'
    );

    return;
  }

  const activeTask =
    getCurrentGrindTask();

  elements.grindBoard.classList.remove(
    'hidden'
  );

  elements.taskPanel.classList.add(
    'hidden'
  );

  elements.listPanel.classList.add(
    'hidden'
  );

  elements.grindTaskName.textContent =
    activeTask
      ? activeTask.title
      : 'All tasks complete';

  elements.grindTimer.textContent =
    formatTime(
      state.grindTimerSeconds
    );

  elements.grindPauseBtn.textContent =
    state.grindTimerId
      ? 'Pause'
      : 'Resume';

  elements.grindButton.disabled =
    !activeTask;

  renderProgress();

  renderGrindChecklist(
    activeTask
  );
}

/* =========================================================
   SETTINGS
   ========================================================= */

async function loadSettingsIntoUI() {
  const settings =
    await safeGetSettings();

  state.settingsSites =
    Array.isArray(
      settings.sites
    )
      ? settings.sites.map(
          site => ({
            host: String(
              site.host
            ),
            mode:
              site.mode ===
              'checkin'
                ? 'checkin'
                : 'block',
          })
        )
      : [];

  state.checkInMinutes =
    Number(
      settings.checkInMinutes
    ) || 60;

  elements.checkinMinutes.value =
    String(
      state.checkInMinutes
    );
}

function renderSettings() {
  elements.settingsPanel.classList.toggle(
    'hidden',
    !state.settingsOpen
  );

  if (
    elements.appShell
  ) {
    elements.appShell.classList.toggle(
      'settings-open',
      state.settingsOpen
    );
  }

  elements.editorModeBtn.textContent =
    state.editingSites
      ? 'Done editing'
      : 'Edit list';

  elements.addSiteForm.classList.toggle(
    'hidden',
    !state.editingSites
  );

  const extensionAvailable =
    typeof chrome !== 'undefined' &&
    Boolean(
      chrome.runtime?.id
    );

  elements.settingsNotice.classList.toggle(
    'hidden',
    extensionAvailable
  );

  elements.sitesList.innerHTML =
    '';

  if (
    !state.settingsSites.length
  ) {
    const empty =
      document.createElement(
        'li'
      );

    empty.className =
      'empty-state';

    empty.textContent =
      'No managed sites.';

    elements.sitesList.appendChild(
      empty
    );

    return;
  }

  state.settingsSites.forEach(
    (site, index) => {
      const row =
        document.createElement(
          'li'
        );

      row.className =
        'site-row';

      const host =
        document.createElement(
          'span'
        );

      host.className =
        'site-host';

      host.textContent =
        site.host;

      const toggle =
        document.createElement(
          'div'
        );

      toggle.className =
        'site-toggle';

      ['block', 'checkin']
        .forEach(mode => {
          const button =
            makeButton(
              mode === 'block'
                ? 'Block'
                : 'Check-in',
              'site-toggle-btn'
            );

          if (
            site.mode ===
            mode
          ) {
            button.classList.add(
              'active'
            );
          }

          button.disabled =
            !state.editingSites;

          button.addEventListener(
            'click',
            () => {
              site.mode =
                mode;

              renderSettings();
            }
          );

          toggle.appendChild(
            button
          );
        });

      const remove =
        makeButton(
          '×',
          'site-delete-btn'
        );

      remove.disabled =
        !state.editingSites;

      remove.title =
        'Remove site';

      remove.addEventListener(
        'click',
        () => {
          state.settingsSites.splice(
            index,
            1
          );

          renderSettings();
        }
      );

      row.append(
        host,
        toggle,
        remove
      );

      elements.sitesList.appendChild(
        row
      );
    }
  );
}

/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {
  renderTaskList();
  renderGrindBoard();
  renderSettings();
}

/* =========================================================
   TASK ACTIONS
   ========================================================= */

async function addTask(event) {
  event.preventDefault();

  const title =
    elements.taskName.value.trim();

  const minutes =
    clampNumber(
      elements.taskDuration.value,
      1,
      180,
      25
    );

  if (!title) {
    return;
  }

  const task = {
    id: uid(),
    title,
    minutes,
    completed: false,
    subtasks: [],
  };

  state.tasks.push(task);

  state.selectedTaskId =
    task.id;

  await saveState();

  elements.taskForm.reset();

  elements.taskDuration.value =
    '25';

  renderAll();

  elements.taskName.focus();
}

async function deleteTask(id) {
  const index =
    state.tasks.findIndex(
      task =>
        task.id === id
    );

  if (index === -1) {
    return;
  }

  state.tasks.splice(
    index,
    1
  );

  state.grindTaskIds =
    state.grindTaskIds.filter(
      taskId =>
        taskId !== id
    );

  if (
    state.selectedTaskId ===
    id
  ) {
    state.selectedTaskId =
      state.tasks[0]?.id ||
      null;
  }

  if (
    state.grindCurrentId ===
    id
  ) {
    stopTimer();

    state.grindCurrentId =
      null;

    state.grindTimerSeconds =
      0;

    const next =
      getCurrentGrindTask();

    if (next) {
      startFreshTimerForTask(
        next
      );
    }
  }

  await saveState();

  renderAll();
}

/* =========================================================
   SUBTASKS
   ========================================================= */

function openSubtaskMenu(task) {
  elements.subtaskMenu.dataset.parentId =
    task.id;

  elements.subtaskParentName.textContent =
    'For: ' + task.title;

  elements.subtaskName.value =
    '';

  elements.subtaskDuration.value =
    '5';

  elements.subtaskMenu.classList.remove(
    'hidden'
  );

  elements.subtaskName.focus();
}

function closeSubtaskMenu() {
  elements.subtaskMenu.classList.add(
    'hidden'
  );

  delete elements.subtaskMenu.dataset.parentId;
}

async function addSubtask(event) {
  event.preventDefault();

  const parent =
    findTaskNode(
      elements.subtaskMenu.dataset.parentId
    );

  const title =
    elements.subtaskName.value.trim();

  const minutes =
    clampNumber(
      elements.subtaskDuration.value,
      1,
      180,
      5
    );

  if (
    !parent ||
    !title
  ) {
    return;
  }

  parent.subtasks.push({
    id: uid('subtask'),
    title,
    minutes,
    completed: false,
  });

  await saveState();

  closeSubtaskMenu();

  renderAll();
}

/* =========================================================
   TIMER
   ========================================================= */

function stopTimer() {
  if (
    state.grindTimerId !==
    null
  ) {
    clearInterval(
      state.grindTimerId
    );

    state.grindTimerId =
      null;
  }
}

function startFreshTimerForTask(
  task
) {
  stopTimer();

  state.grindCurrentId =
    task.id;

  state.grindTimerSeconds =
    task.minutes * 60;

  state.grindTimerId =
    setInterval(
      timerTick,
      1000
    );
}

function advanceToNextTask() {
  const next =
    getSessionTasks().find(
      task =>
        !task.completed
    );

  if (!next) {
    stopTimer();

    state.grindCurrentId =
      null;

    state.grindTimerSeconds =
      0;

    return;
  }

  startFreshTimerForTask(
    next
  );
}

async function timerTick() {
  if (
    !state.grindMode ||
    !state.grindTimerId
  ) {
    return;
  }

  state.grindTimerSeconds =
    Math.max(
      0,
      state.grindTimerSeconds - 1
    );

  renderGrindBoard();

  if (
    state.grindTimerSeconds >
    0
  ) {
    if (
      state.grindTimerSeconds %
        5 ===
      0
    ) {
      await saveState();
    }

    return;
  }

  const task =
    getCurrentGrindTask();

  if (task) {
    task.completed =
      true;
  }

  advanceToNextTask();

  await saveState();

  renderAll();
}

async function togglePause() {
  const task =
    getCurrentGrindTask();

  if (!task) {
    return;
  }

  if (
    state.grindTimerId
  ) {
    stopTimer();
  } else {
    state.grindTimerId =
      setInterval(
        timerTick,
        1000
      );
  }

  await saveState();

  renderGrindBoard();
}

async function resetTimer() {
  const task =
    getCurrentGrindTask();

  if (!task) {
    return;
  }

  startFreshTimerForTask(
    task
  );

  await saveState();

  renderGrindBoard();
}

async function extendTimer() {
  if (
    !getCurrentGrindTask()
  ) {
    return;
  }

  state.grindTimerSeconds +=
    5 * 60;

  await saveState();

  renderGrindBoard();
}

async function markCurrentDone() {
  const task =
    getCurrentGrindTask();

  if (!task) {
    return;
  }

  await deleteTask(
    task.id
  );
}

/* =========================================================
   GRIND MODE
   ========================================================= */

async function startGrind() {
  if (!state.tasks.length) {
    return;
  }

  const unfinished =
    state.tasks.filter(
      task =>
        !task.completed
    );

  if (!unfinished.length) {
    state.tasks.forEach(
      task => {
        task.completed =
          false;

        task.subtasks.forEach(
          subtask => {
            subtask.completed =
              false;
          }
        );
      }
    );
  }

  state.grindMode =
    true;

  state.grindTaskIds =
    state.tasks.map(
      task => task.id
    );

  state.grindTotalUnits =
    state.tasks.reduce(
      (sum, task) =>
        sum + countUnits(task),
      0
    );

  let first =
    findTaskNode(
      state.selectedTaskId
    );

  if (
    !first ||
    first.completed
  ) {
    first =
      getCurrentGrindTask();
  }

  if (!first) {
    first =
      state.tasks[0] ||
      null;
  }

  if (first) {
    startFreshTimerForTask(
      first
    );
  }

  await saveState();

  await setGrindActiveSafe(
    true
  );

  await closeDistractionsSafe();

  renderAll();

  // First time on the GRIND screen: show its tour.
  window.Onboarding.startIfFirstRun();
}

async function endGrind() {
  stopTimer();

  state.grindMode =
    false;

  state.grindCurrentId =
    null;

  state.grindTimerSeconds =
    0;

  await saveState();

  await setGrindActiveSafe(
    false
  );

  renderAll();
}

/* =========================================================
   EXTENSION FUNCTIONS
   ========================================================= */

async function setGrindActiveSafe(
  active
) {
  if (
    typeof setGrindActive !==
    'function'
  ) {
    return;
  }

  try {
    await setGrindActive(
      active
    );
  } catch (error) {
    console.warn(
      'Could not update extension GRIND state.',
      error
    );
  }
}

async function closeDistractionsSafe() {
  if (
    typeof closeDistractions !==
    'function'
  ) {
    return;
  }

  try {
    await closeDistractions();
  } catch (error) {
    console.warn(
      'Could not close distracting tabs.',
      error
    );
  }
}

/* =========================================================
   SETTINGS UI
   ========================================================= */

async function toggleSettings() {
  if (!state.settingsOpen) {
    await loadSettingsIntoUI();
  }

  state.settingsOpen =
    !state.settingsOpen;

  state.editingSites =
    false;

  renderSettings();
}

function toggleSiteEditing() {
  state.editingSites =
    !state.editingSites;

  renderSettings();
}

function addSiteFromForm(
  event
) {
  event.preventDefault();

  const host =
    elements.addSiteHost.value
      .trim()
      .toLowerCase();

  if (!host) {
    return;
  }

  const exists =
    state.settingsSites.some(
      site =>
        site.host === host
    );

  if (exists) {
    elements.settingsStatus.textContent =
      'That site is already in the list.';

    return;
  }

  state.settingsSites.push({
    host,

    mode:
      elements.addSiteBlock.checked
        ? 'block'
        : 'checkin',
  });

  elements.addSiteForm.reset();

  elements.addSiteBlock.checked =
    true;

  elements.settingsStatus.textContent =
    'Site added. Press Save to apply it.';

  renderSettings();
}

async function saveSettingsFromUI() {
  const minutes =
    clampNumber(
      elements.checkinMinutes.value,
      1,
      600,
      60
    );

  await safeSaveSettings({
    sites:
      state.settingsSites,

    checkInMinutes:
      minutes,
  });

  state.checkInMinutes =
    minutes;

  elements.checkinMinutes.value =
    String(minutes);

  elements.settingsStatus.textContent =
    'Saved.';

  setTimeout(() => {
    if (
      elements.settingsStatus.textContent ===
      'Saved.'
    ) {
      elements.settingsStatus.textContent =
        '';
    }
  }, 1800);
}

async function resetSettingsFromUI() {
  await safeResetSettings();

  await loadSettingsIntoUI();

  state.editingSites =
    false;

  elements.settingsStatus.textContent =
    'Defaults restored.';

  renderSettings();
}

/* =========================================================
   CANVAS
   ========================================================= */

function initializeCanvasBackground() {
  const canvas =
    document.getElementById(
      'bg-canvas'
    );

  if (
    !canvas ||
    typeof setupCanvas !==
      'function' ||
    typeof startRenderLoop !==
      'function'
  ) {
    return;
  }

  let pointer = null;

  if (
    typeof setupInput ===
    'function'
  ) {
    try {
      pointer =
        setupInput(
          window
        );
    } catch (error) {
      console.warn(
        'Canvas input unavailable.',
        error
      );
    }
  }

  try {
    const result =
      setupCanvas(canvas);

    if (
      !result ||
      !result.context
    ) {
      return;
    }

    const context =
      result.context;

    startRenderLoop(() => {
      const width =
        window.innerWidth;

      const height =
        window.innerHeight;

      context.clearRect(
        0,
        0,
        width,
        height
      );

      const px =
        pointer?.normalizedX ??
        0.5;

      const py =
        pointer?.normalizedY ??
        0.5;

      const radius =
        Math.max(
          width,
          height
        ) * 0.65;

      const gradient =
        context.createRadialGradient(
          width * px,
          height * py,
          0,
          width * px,
          height * py,
          radius
        );

      gradient.addColorStop(
        0,
        'rgba(255, 154, 61, 0.045)'
      );

      gradient.addColorStop(
        1,
        'rgba(255, 154, 61, 0)'
      );

      context.fillStyle =
        gradient;

      context.fillRect(
        0,
        0,
        width,
        height
      );
    });
  } catch (error) {
    console.warn(
      'Canvas background disabled.',
      error
    );
  }
}

/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {
  elements.taskForm.addEventListener(
    'submit',
    addTask
  );

  elements.startGrindBtn.addEventListener(
    'click',
    startGrind
  );

  elements.backToHomeBtn.addEventListener(
    'click',
    endGrind
  );

  elements.grindButton.addEventListener(
    'click',
    markCurrentDone
  );

  elements.grindPauseBtn.addEventListener(
    'click',
    togglePause
  );

  elements.grindResetBtn.addEventListener(
    'click',
    resetTimer
  );

  elements.grindExtendBtn.addEventListener(
    'click',
    extendTimer
  );

  elements.settingsBtn.addEventListener(
    'click',
    toggleSettings
  );

  elements.settingsClose.addEventListener(
    'click',
    () => {
      state.settingsOpen =
        false;

      state.editingSites =
        false;

      renderSettings();
    }
  );

  elements.editorModeBtn.addEventListener(
    'click',
    toggleSiteEditing
  );

  elements.addSiteForm.addEventListener(
    'submit',
    addSiteFromForm
  );

  elements.settingsSave.addEventListener(
    'click',
    saveSettingsFromUI
  );

  elements.settingsReset.addEventListener(
    'click',
    resetSettingsFromUI
  );

  elements.closeSubtaskMenu.addEventListener(
    'click',
    closeSubtaskMenu
  );

  elements.subtaskForm.addEventListener(
    'submit',
    addSubtask
  );

  document.addEventListener(
    'keydown',
    event => {
      if (
        event.key ===
        'Escape'
      ) {
        closeSubtaskMenu();
      }
    }
  );
}

/* =========================================================
   STARTUP
   ========================================================= */

async function initializeApp() {
  cacheElements();

  await loadState();

  await loadSettingsIntoUI();

  bindEvents();

  initializeCanvasBackground();

  if (state.grindMode) {
    const active =
      getCurrentGrindTask();

    if (active) {
      if (
        state.grindTimerSeconds <=
        0
      ) {
        state.grindTimerSeconds =
          active.minutes * 60;
      }

      startFreshTimerForTask(
        active
      );
    } else {
      state.grindMode =
        false;

      stopTimer();

      await setGrindActiveSafe(
        false
      );
    }
  }

  renderAll();

  const warning =
    document.getElementById(
      'load-warning'
    );

  if (warning) {
    warning.remove();
  }

  // First-run tour (see the ONBOARDING section at the bottom of this file).
  // Does nothing after the first time.
  window.Onboarding.startIfFirstRun();
}

/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {
    initializeApp().catch(
      error => {
        console.error(
          'Reminder App failed to initialize:',
          error
        );

        const warning =
          document.getElementById(
            'load-warning'
          );

        if (warning) {
          warning.style.opacity =
            '1';

          warning.style.pointerEvents =
            'auto';

          warning.innerHTML =
            '<strong>The app could not start.</strong><br>' +
            'Open the Console and look at the red error immediately above this message.';
        }
      }
    );
  }
);


/* =========================================================
   ONBOARDING: TOURS
   Two tours that highlight things in the order you should use them:
     HOME  - Add a task, + mini, a mini tour of Blocked sites, GRIND
     GRIND - the GRIND screen (task, timer, progress, I'm done, Back)
   Each one shows by itself the first time you reach that screen.
   The ? button in the header replays the tour for the screen you are on.
   To change a tour, edit its list of steps below.
   ========================================================= */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const isShown = (el) => !!el && !el.classList.contains('hidden');
  const taskCount = () => document.querySelectorAll('#task-list .task-item').length;
  const onGrindScreen = () => isShown($('#grind-board'));

  // Anything a step needs to remember while it is showing.
  let memo = {};

  // ---------- HOME tour ----------

  const HOME_STEPS = [
    {
      title: 'Add a task',
      onEnter() {
        memo.startCount = taskCount();
      },
      resolve() {
        return {
          target: $('.task-panel'),
          badge: 'START HERE',
          text: 'Start here. Type what you want to get done and how many minutes you will give it, then press Add task.',
        };
      },
      shouldAdvance() {
        return taskCount() > memo.startCount;
      },
    },
    {
      title: 'Split it into mini tasks',
      resolve() {
        if (isShown($('#subtask-menu'))) {
          return {
            target: $('#subtask-menu'),
            badge: 'FILL THIS IN',
            text: 'Name the mini task and give it a few minutes, then press Add.',
          };
        }
        const miniButton = $('#task-list .task-actions button:not(.task-delete)');
        if (miniButton) {
          return {
            target: miniButton,
            badge: 'CLICK + MINI',
            text: 'Press + mini to break your task into smaller steps. Each one gets its own checkbox and time during GRIND.',
          };
        }
        return {
          target: $('.list-panel'),
          badge: 'LOOK HERE',
          text: 'Once you have a task, a + mini button shows up on it. Use it to split the task into smaller steps.',
        };
      },
      shouldAdvance() {
        const open = isShown($('#subtask-menu'));
        if (open) memo.menuSeen = true;
        return !!memo.menuSeen && !open;
      },
    },
    {
      title: 'Open Blocked sites',
      resolve() {
        return {
          target: $('#settings-btn'),
          badge: 'CLICK HERE',
          text: 'Blocked sites lets you choose which websites get shut down while GRIND is running. Press Next and the tour will open it for you.',
        };
      },
      // Next opens the panel; the step finishes once it is actually showing.
      onNext() {
        if (!isShown($('#settings-panel'))) $('#settings-btn').click();
        return false;
      },
      shouldAdvance() {
        return isShown($('#settings-panel'));
      },
    },
    {
      title: 'Block or Check-in',
      resolve() {
        return {
          target: $('#sites-list'),
          badge: 'THE LIST',
          text: 'These are the sites that count as distractions. Block closes a site the moment you open it. Check-in lets it stay open, then asks if you are being productive.',
        };
      },
      shouldAdvance() { return false; },
    },
    {
      title: 'Check-in time',
      resolve() {
        return {
          target: $('#settings-panel .setting-row'),
          badge: 'SET THE TIME',
          text: 'For Check-in sites, this is how many minutes they can stay open before you get asked if you are being productive.',
        };
      },
      shouldAdvance() { return false; },
    },
    {
      title: 'Change the list',
      resolve() {
        return {
          target: $('#settings-panel .editor-toggle-row'),
          badge: 'EDIT LIST',
          text: 'Press Edit list to add your own sites, remove ones you do not want, or switch a site between Block and Check-in.',
        };
      },
      shouldAdvance() { return false; },
    },
    {
      title: 'Save your changes',
      resolve() {
        return {
          // The panel is taller than the window, so the card sits above this row.
          target: $('#settings-panel .settings-actions'),
          badge: 'SAVE OR CLOSE',
          text: 'Save keeps your changes. Reset to defaults brings back the original list. Close shuts the panel. Press Next and the tour will close it for you.',
        };
      },
      // Next closes the panel so the tour can carry on with the home screen.
      onNext() {
        if (isShown($('#settings-panel'))) $('#settings-close').click();
        return true;
      },
      shouldAdvance() { return false; },
    },
    {
      title: 'Start GRIND',
      resolve() {
        return {
          target: $('#start-grind-btn'),
          badge: 'CLICK GRIND',
          text: 'When you are ready, press GRIND. A countdown starts for your first task and your blocked sites get closed until you are done.',
        };
      },
      shouldAdvance() {
        return false; // ends when GRIND is pressed or Got it is clicked
      },
    },
  ];

  // ---------- GRIND tour ----------

  const GRIND_STEPS = [
    {
      title: 'Your current task',
      resolve() {
        return {
          target: $('#grind-board .grind-heading'),
          badge: 'YOUR TASK',
          text: 'This is the task you are working on right now. If it has mini tasks, they show up below it as checkboxes. Tick each one as you finish it.',
        };
      },
      shouldAdvance() { return false; },
    },
    {
      title: 'The timer',
      resolve() {
        return {
          target: $('#grind-board .grind-timer'),
          badge: 'THE TIMER',
          text: 'The countdown for this task. Pause stops it, Reset starts it over, and +5 min gives you extra time.',
        };
      },
      shouldAdvance() { return false; },
    },
    {
      title: 'Your progress',
      resolve() {
        return {
          target: $('#grind-board .progress-panel'),
          badge: 'YOUR PROGRESS',
          text: 'Shows how much of your work you have finished so far. It fills up as you complete tasks and mini tasks.',
        };
      },
      shouldAdvance() { return false; },
    },
    {
      title: 'Finish the task',
      resolve() {
        return {
          target: $('#grind-button'),
          badge: 'WHEN YOU ARE DONE',
          text: 'Press this when you finish the task. It marks it complete and moves you on to the next one.',
        };
      },
      shouldAdvance() { return false; },
    },
    {
      title: 'Leaving GRIND',
      resolve() {
        return {
          target: $('#back-to-home-btn'),
          badge: 'LEAVE GRIND',
          text: 'Back takes you out of GRIND and returns you to your task list.',
        };
      },
      shouldAdvance() { return false; },
    },
  ];

  const HOME = {
    doneKey: 'reminder-app.tourDone.v1',
    steps: HOME_STEPS,
    endOn: '#start-grind-btn', // pressing GRIND ends the home tour
    stillValid: () => !onGrindScreen(),
  };

  const GRIND = {
    doneKey: 'reminder-app.grindTourDone.v1',
    steps: GRIND_STEPS,
    endOn: '#grind-button, #back-to-home-btn',
    stillValid: () => onGrindScreen(),
  };

  // ---------- remembering which tours were seen ----------

  async function wasSeen(key) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const saved = await chrome.storage.local.get(key);
        return !!saved[key];
      }
      return localStorage.getItem(key) === '1';
    } catch (error) {
      return false;
    }
  }

  async function markSeen(key) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [key]: true });
      } else {
        localStorage.setItem(key, '1');
      }
    } catch (error) {
      // Not being able to save just means the tour may show again.
    }
  }

  // ---------- on-screen pieces ----------

  let tour = HOME;
  let active = false;
  let stepIndex = 0;
  let frameId = 0;
  let overlay = null;
  let card = null;
  let ui = {};
  let highlighted = null;
  let spotlight = null;
  let badge = null;
  let shownKey = '';

  function buildCard() {
    overlay = document.createElement('div');
    overlay.className = 'first-run-tour';

    card = document.createElement('div');
    card.className = 'tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-live', 'polite');

    ui.label = document.createElement('div');
    ui.label.className = 'tour-step-label';

    ui.title = document.createElement('h2');
    ui.text = document.createElement('p');

    const actions = document.createElement('div');
    actions.className = 'tour-actions';

    ui.skip = document.createElement('button');
    ui.skip.type = 'button';
    ui.skip.textContent = 'Skip tour';
    ui.skip.addEventListener('click', finish);

    ui.next = document.createElement('button');
    ui.next.type = 'button';
    ui.next.className = 'primary-btn';
    ui.next.addEventListener('click', () => {
      const step = tour.steps[stepIndex];
      // A step can do something first (open/close a panel). If onNext
      // returns false, the step moves on by itself once that has happened.
      if (step.onNext && step.onNext() === false) return;
      goTo(stepIndex + 1);
    });

    actions.append(ui.skip, ui.next);
    card.append(ui.label, ui.title, ui.text, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    buildSpotlight();
  }

  // The spotlight: a bright frame drawn over the target. Its huge shadow
  // darkens everything else on screen, so the target is impossible to miss.
  // It ignores the mouse, so you can still click the highlighted thing.
  function buildSpotlight() {
    spotlight = document.createElement('div');
    spotlight.className = 'tour-spotlight';
    badge = document.createElement('div');
    badge.className = 'tour-badge';
    spotlight.appendChild(badge);
    overlay.appendChild(spotlight);
  }

  function moveSpotlight(el, rect) {
    const pad = 6;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    spotlight.style.top = rect.top - pad + 'px';
    spotlight.style.left = rect.left - pad + 'px';
    spotlight.style.width = rect.width + pad * 2 + 'px';
    spotlight.style.height = rect.height + pad * 2 + 'px';
    spotlight.style.borderRadius = radius + pad + 'px';

    // Keep the label fully on screen, even over a small button near an edge.
    const bw = badge.offsetWidth;
    const frameLeft = rect.left - pad;
    const frameW = rect.width + pad * 2;
    let screenLeft = frameLeft + frameW - bw - 14; // right-aligned by default
    screenLeft = Math.max(6, Math.min(screenLeft, window.innerWidth - bw - 6));
    badge.style.right = 'auto';
    badge.style.left = screenLeft - frameLeft - 4 + 'px'; // -4 = frame border
  }

  function placeCard(rect) {
    const margin = 12;
    const edge = 8;
    const cardW = card.offsetWidth;
    const cardH = card.offsetHeight;

    let top = rect.bottom + margin;
    if (top + cardH > window.innerHeight - edge) {
      top = rect.top - margin - cardH;
    }
    if (top < edge) {
      // Target is taller than the space around it: dock at the bottom.
      top = window.innerHeight - cardH - edge;
    }

    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(edge, Math.min(left, window.innerWidth - cardW - edge));

    card.style.top = Math.max(edge, top) + 'px';
    card.style.left = left + 'px';
  }

  // ---------- running the steps ----------

  function render() {
    const step = tour.steps[stepIndex];
    const { target, text, badge: badgeText } = step.resolve();

    if (!target || target.getBoundingClientRect().width === 0) {
      goTo(stepIndex + 1); // nothing to point at, skip this step
      return;
    }

    const key = stepIndex + '|' + text;
    if (key !== shownKey) {
      shownKey = key;
      ui.label.textContent = 'Step ' + (stepIndex + 1) + ' of ' + tour.steps.length;
      ui.title.textContent = step.title;
      ui.text.textContent = text;
      badge.textContent = badgeText || 'LOOK HERE';
      ui.next.textContent = stepIndex === tour.steps.length - 1 ? 'Got it' : 'Next';
    }

    if (target !== highlighted) {
      highlighted = target;
      // Scroll up/down only, never sideways.
      const r = target.getBoundingClientRect();
      if (r.top < 8) window.scrollBy({ top: r.top - 8, behavior: 'smooth' });
      else if (r.bottom > window.innerHeight - 8) window.scrollBy({ top: r.bottom - window.innerHeight + 8, behavior: 'smooth' });
    }

    const rect = target.getBoundingClientRect();
    moveSpotlight(target, rect);
    placeCard(rect);
  }

  function frame() {
    if (!active) return;
    if (!tour.stillValid()) { // e.g. they left the screen this tour is about
      finish();
      return;
    }
    if (tour.steps[stepIndex].shouldAdvance()) {
      goTo(stepIndex + 1);
    }
    if (active) {
      render();
      frameId = requestAnimationFrame(frame);
    }
  }

  function goTo(index) {
    if (index >= tour.steps.length) {
      finish();
      return;
    }
    stepIndex = index;
    memo = {};
    shownKey = '';
    if (tour.steps[stepIndex].onEnter) tour.steps[stepIndex].onEnter();
  }

  function start(which) {
    if (active) finish();
    tour = which;
    active = true;
    buildCard();
    goTo(0);
    frame();
  }

  function finish() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frameId);
    highlighted = null;
    if (overlay) overlay.remove();
    overlay = card = spotlight = badge = null;
    ui = {};
    markSeen(tour.doneKey);
  }

  // Pressing the button a tour is leading up to means they are off and running.
  document.addEventListener('click', (event) => {
    if (active && event.target instanceof Element && event.target.closest(tour.endOn)) {
      finish();
    }
  }, true);

  // The ? button replays the tour for the screen you are on.
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('#help-btn')) {
      start(onGrindScreen() ? GRIND : HOME);
    }
  });

  window.Onboarding = {
    // Called when the app opens and again right after GRIND starts.
    // Shows the tour for the current screen if it has not been seen yet.
    async startIfFirstRun() {
      if (active) return;
      const which = onGrindScreen() ? GRIND : HOME;
      if (!(await wasSeen(which.doneKey))) start(which);
    },
    replay() {
      start(onGrindScreen() ? GRIND : HOME);
    },
  };
})();


/* =========================================================
   ONBOARDING: HOVER DESCRIPTIONS
   Shown while the tour is running. Edit TIPS to change text.
   ========================================================= */
// Hover descriptions. While the tour is running, hover (or pause on) any
// button or field and a small box explains what it does. Outside the tour
// nothing is shown.
//
// To describe a new control, add a line to TIPS: [css selector, text].
// The text can also be a function (element) => string when it depends on
// the element's state. The FIRST matching selector wins, so put specific
// selectors above general ones.
//
// Matching happens at hover time, so buttons that are re-created when the
// list re-renders (+ mini, x, checkboxes...) are covered automatically.

(() => {
  const SHOW_DELAY_MS = 350;

  const TIPS = [
    // --- header ---
    ['#help-btn', 'Replay the quick tour that shows you how this app works.'],
    ['#settings-btn', 'Choose which sites get closed, or checked on, while GRIND is running.'],

    // --- add a task ---
    ['#task-name', 'Type what you want to get done.'],
    ['#task-duration', 'How many minutes you want to spend on this task.'],
    ['#task-form button[type="submit"]', 'Add this task to your task list.'],

    // --- task list ---
    ['#start-grind-btn', 'Start GRIND: a countdown runs for each task and your blocked sites get closed.'],
    ['#task-list .task-select', 'Select this task.'],
    ['#task-list .task-delete', 'Delete this task.'],
    ['#task-list .subtask-details summary', 'Show or hide the mini tasks inside this task.'],
    ['#task-list .task-actions button', 'Break this task into smaller mini tasks, each with its own time.'],

    // --- mini task popup ---
    ['#close-subtask-menu', 'Close without adding a mini task.'],
    ['#subtask-name', 'Name the small step you want to do inside this task.'],
    ['#subtask-duration', 'How many minutes this mini task should take.'],
    ['#subtask-form button[type="submit"]', 'Add this mini task to its task.'],

    // --- blocked sites panel ---
    ['#checkin-minutes', 'How long a Check-in site can stay open before you get asked if you are being productive.'],
    ['#editor-mode-btn', 'Turn editing on or off so you can change, add or remove sites.'],
    ['#add-site-host', 'Type a site like example.com. Start with * to match any site containing a word, like *word.'],
    ['#add-site-form .inline-checkbox', 'Checked: the site is closed instantly. Unchecked: it is allowed and you get a check-in.'],
    ['#add-site-form button[type="submit"]', 'Add this site to the list.'],
    ['#settings-save', 'Save your blocked sites and check-in time.'],
    ['#settings-reset', 'Put the blocked sites list back to the original defaults.'],
    ['#settings-close', 'Close this panel.'],
    ['.site-toggle-btn', (el) => {
      const label = el.textContent.trim() === 'Block'
        ? 'Block: this site is closed the moment you open it.'
        : 'Check-in: this site stays open, but you get asked if you are being productive.';
      return el.disabled ? label + ' Press Edit list to change it.' : label;
    }],
    ['.site-delete-btn', (el) => el.disabled ? 'Remove this site. Press Edit list first.' : 'Remove this site from the list.'],

    // --- GRIND screen ---
    ['#back-to-home-btn', 'Leave GRIND and go back to your task list.'],
    ['#grind-pause-btn', (el) => el.textContent.trim().toLowerCase() === 'pause'
      ? 'Pause the countdown.'
      : 'Resume the countdown.'],
    ['#grind-reset-btn', 'Restart the countdown for the current task.'],
    ['#grind-extend-btn', 'Add 5 more minutes to the countdown.'],
    ['#grind-button', 'Mark the current task as finished and move on to the next one.'],
    ['#grind-checklist input[type="checkbox"]', 'Tick this when it is done.'],
  ];

  let tipEl = null;
  let showTimer = null;
  let current = null;

  function getTipEl() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'hover-tip';
      tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function findTip(node) {
    if (!(node instanceof Element)) return null;
    for (const [selector, text] of TIPS) {
      const el = node.closest(selector);
      if (el) return { el, text: typeof text === 'function' ? text(el) : text };
    }
    return null;
  }

  function place(el) {
    const tip = getTipEl();
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;

    let top = rect.bottom + gap;
    if (top + th > window.innerHeight - 6) top = rect.top - gap - th;
    top = Math.max(6, top);

    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  function show(hit) {
    if (!document.contains(hit.el)) return;
    const tip = getTipEl();
    tip.textContent = hit.text;
    place(hit.el);
    tip.classList.add('visible');
  }

  function hide() {
    clearTimeout(showTimer);
    showTimer = null;
    current = null;
    if (tipEl) tipEl.classList.remove('visible');
  }

  const tourRunning = () => !!document.querySelector('.first-run-tour');

  document.addEventListener('mouseover', (event) => {
    if (!tourRunning()) return hide();

    // Some controls carry a native title; ours replaces it so two boxes don't stack.
    const titled = event.target instanceof Element ? event.target.closest('[title]') : null;
    if (titled) titled.removeAttribute('title');

    const hit = findTip(event.target);
    if (!hit) return hide();
    if (hit.el === current) return;

    hide();
    current = hit.el;
    showTimer = setTimeout(() => show(hit), SHOW_DELAY_MS);
  });

  document.addEventListener('mouseout', (event) => {
    if (current && !current.contains(event.relatedTarget)) hide();
  });

  // Clicking usually re-renders the list, so never leave a tip behind.
  document.addEventListener('mousedown', hide, true);
  document.addEventListener('click', hide, true);
  document.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
})();