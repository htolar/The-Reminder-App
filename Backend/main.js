'use strict';

const STORAGE_KEY = 'reminder-app.state.v4';

const state = {
  tasks: [],
  selectedTaskId: null,
  grindMode: false,
  grindTaskIds: [],
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
  const tasks =
    getSessionTasks();

  const total =
    tasks.reduce(
      (sum, task) =>
        sum + countUnits(task),
      0
    );

  const completed =
    tasks.reduce(
      (sum, task) =>
        sum +
        countCompletedUnits(
          task
        ),
      0
    );

  if (!total) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      (completed / total) *
        100
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
        task.completed =
          checkbox.checked;

        if (
          task.id ===
            state.grindCurrentId &&
          task.completed
        ) {
          stopTimer();
          state.grindTimerSeconds =
            0;
          advanceToNextTask();
        }

        await saveState();
        renderAll();
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
      checkbox,
      title
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
              subtask.completed =
                subCheck.checked;

              await saveState();

              renderAll();
            }
          );

          const subTitle =
            document.createElement(
              'span'
            );

          subTitle.textContent =
            subtask.title +
            ' — ' +
            subtask.minutes +
            ' min';

          row.append(
            subCheck,
            subTitle
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

  task.completed =
    true;

  advanceToNextTask();

  await saveState();

  renderAll();
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