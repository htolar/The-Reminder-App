import { startRenderLoop } from './src/Canvas/loop.js';
import { setupCanvas } from './src/Canvas/setupCanvas.js';
import { setupInput } from './src/Canvas/input.js';
import { clamp, lerp, mapRange } from './src/Canvas/math.js';

const STORAGE_KEY = 'reminder-app.tasks.v1';

const defaultTasks = [
  { id: crypto.randomUUID(), title: 'Read 20 minutes', minutes: 20, completed: false },
  { id: crypto.randomUUID(), title: 'Review notes', minutes: 10, completed: false },
];

const state = {
  tasks: loadTasks(),
  selectedTaskId: null,
  grindMode: false,
  grindTaskIds: [],   // snapshot of task ids present when the grind session started
  grindTotalUnits: 0, // total leaf units (tasks-without-subtasks + all subtasks) at session start
  grindTimerSeconds: 0,
  grindTimerId: null,
};

const elements = {
  taskForm: document.querySelector('#task-form'),
  taskName: document.querySelector('#task-name'),
  taskDuration: document.querySelector('#task-duration'),
  taskPanel: document.querySelector('.task-panel'),
  taskList: document.querySelector('#task-list'),
  listPanel: document.querySelector('.list-panel'),
  startGrindBtn: document.querySelector('#start-grind-btn'),
  grindBoard: document.querySelector('#grind-board'),
  grindChecklist: document.querySelector('#grind-checklist'),
  grindTaskName: document.querySelector('#grind-task-name'),
  grindProgressPercent: document.querySelector('#grind-progress-percent'),
  grindProgressTrackBg: document.querySelector('#grind-progress-track-bg'),
  grindProgressFill: document.querySelector('#grind-progress-fill'),
  grindProgressCode: document.querySelector('#grind-progress-code'),
  grindTimer: document.querySelector('#grind-timer'),
  grindPauseBtn: document.querySelector('#grind-pause-btn'),
  grindResetBtn: document.querySelector('#grind-reset-btn'),
  grindExtendBtn: document.querySelector('#grind-extend-btn'),
  grindButton: document.querySelector('#grind-button'),
  backToHomeBtn: document.querySelector('#back-to-home-btn'),
  subtaskMenu: document.querySelector('#subtask-menu'),
  subtaskForm: document.querySelector('#subtask-form'),
  subtaskName: document.querySelector('#subtask-name'),
  subtaskDuration: document.querySelector('#subtask-duration'),
  subtaskParentName: document.querySelector('#subtask-parent-name'),
  closeSubtaskMenu: document.querySelector('#close-subtask-menu'),
};

let subtaskParentId = null;
let previousGrindPercent = null; // used to detect a change and trigger the pulse/flash

const canvas = document.querySelector('#bg-canvas');
const canvasState = setupCanvas(canvas);
const pointer = setupInput();

// ============================================================================
// Persistence
// ============================================================================

function loadTasks() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultTasks;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultTasks;
  } catch (error) {
    return defaultTasks;
  }
}

function saveTasks() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

// ============================================================================
// Task tree helpers
// ============================================================================

function getTaskMinutes(task) {
  if (Array.isArray(task.subtasks) && task.subtasks.length) {
    return task.subtasks.reduce((total, subtask) => total + getTaskMinutes(subtask), 0);
  }
  return task.minutes;
}

function findTaskNode(taskId, tasks = state.tasks) {
  for (const task of tasks) {
    if (task.id === taskId) return task;
    const nested = findTaskNode(taskId, task.subtasks ?? []);
    if (nested) return nested;
  }
  return null;
}

function hasIncompleteSubtasks(task) {
  return Array.isArray(task.subtasks) && task.subtasks.some((s) => !s.completed || hasIncompleteSubtasks(s));
}

function getUnfinishedTasks() {
  return state.tasks.filter((t) => !t.completed);
}

function getCurrentGrindTask() {
  return getUnfinishedTasks()[0] ?? null;
}

// A "unit" is a leaf: a task with no subtasks, or a single subtask.
// This is what the progress bar counts, so completing an individual
// subtask moves the bar — not just finishing an entire task.
function countUnits(task) {
  if (Array.isArray(task.subtasks) && task.subtasks.length) {
    return task.subtasks.reduce((sum, s) => sum + countUnits(s), 0);
  }
  return 1;
}

function countCompletedUnits(task) {
  if (Array.isArray(task.subtasks) && task.subtasks.length) {
    return task.subtasks.reduce((sum, s) => sum + countCompletedUnits(s), 0);
  }
  return task.completed ? 1 : 0;
}

// ============================================================================
// Task list rendering
// ============================================================================

function renderSubtaskDetails(subtasks) {
  if (!Array.isArray(subtasks) || !subtasks.length) return '';
  return `<details class="subtask-details"><summary>${subtasks.length} mini task${subtasks.length === 1 ? '' : 's'}</summary><ul class="subtask-list">${subtasks
    .map((s) => `<li>${s.title} — ${getTaskMinutes(s)} min</li>`)
    .join('')}</ul></details>`;
}

function renderTaskList() {
  if (!state.tasks.length) {
    elements.taskList.innerHTML = '<li class="empty-state">No tasks yet. Add one to begin.</li>';
    return;
  }

  elements.taskList.innerHTML = state.tasks
    .map((task) => {
      const selectedClass = task.id === state.selectedTaskId ? 'selected' : '';
      const removingClass = task.removing ? 'removing' : '';
      const statusText = task.completed ? 'Done' : `${getTaskMinutes(task)} min`;
      return `
        <li class="task-item ${selectedClass} ${removingClass}" data-task-id="${task.id}">
          <div style="flex:1">
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" class="task-select" data-task-id="${task.id}">${task.title}</button>
              <span class="task-duration">${statusText}</span>
            </div>
            ${renderSubtaskDetails(task.subtasks)}
          </div>
          <button type="button" data-add-sub="${task.id}" title="Add mini task">+</button>
          <button type="button" data-delete-id="${task.id}">Delete</button>
        </li>
      `;
    })
    .join('');

  bindTaskListEvents();
}

function bindTaskListEvents() {
  elements.taskList.querySelectorAll('.task-select').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedTaskId = button.dataset.taskId;
      render();
    });
  });

  elements.taskList.querySelectorAll('[data-add-sub]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const rect = button.getBoundingClientRect();
      showSubtaskMenu(button.dataset.addSub, rect.left, rect.bottom + 6);
    });
  });

  elements.taskList.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      state.tasks = state.tasks.filter((t) => t.id !== button.dataset.deleteId);
      saveTasks();
      syncSelection();
      render();
    });
  });
}

function syncSelection() {
  if (!state.tasks.length) {
    state.selectedTaskId = null;
    return;
  }
  if (!state.selectedTaskId || !state.tasks.some((t) => t.id === state.selectedTaskId)) {
    state.selectedTaskId = state.tasks[0].id;
  }
}

// ============================================================================
// Task lifecycle
// ============================================================================

function handleTaskSubmit(event) {
  event.preventDefault();
  const title = elements.taskName.value.trim();
  const minutes = Number(elements.taskDuration.value);
  if (!title || !Number.isFinite(minutes) || minutes <= 0) return;

  const newTask = { id: crypto.randomUUID(), title, minutes, completed: false };
  state.tasks.unshift(newTask);
  state.selectedTaskId = newTask.id;
  saveTasks();
  elements.taskForm.reset();
  elements.taskDuration.value = 25;
  render();
}

function removeCompletedTasks() {
  const completed = state.tasks.filter((t) => t.completed);
  if (!completed.length) return;
  completed.forEach((t) => { t.removing = true; });
  render();
  window.setTimeout(() => {
    state.tasks = state.tasks.filter((t) => !t.completed);
    saveTasks();
    syncSelection();
    render();
  }, 200);
}

// ============================================================================
// Subtask popup
// ============================================================================

function showSubtaskMenu(taskId, x, y) {
  const task = findTaskNode(taskId);
  if (!task) return;
  subtaskParentId = taskId;
  elements.subtaskParentName.textContent = task.title;
  elements.subtaskMenu.classList.remove('hidden');
  elements.subtaskMenu.style.left = `${Math.min(x, window.innerWidth - 260)}px`;
  elements.subtaskMenu.style.top = `${Math.min(y, window.innerHeight - 170)}px`;
  elements.subtaskName.focus();
}

function hideSubtaskMenu() {
  subtaskParentId = null;
  elements.subtaskMenu.classList.add('hidden');
  elements.subtaskForm.reset();
  elements.subtaskDuration.value = 5;
}

function handleSubtaskSubmit(event) {
  event.preventDefault();
  const parent = findTaskNode(subtaskParentId);
  const title = elements.subtaskName.value.trim();
  const minutes = Number(elements.subtaskDuration.value);
  if (!parent || !title || !Number.isFinite(minutes) || minutes <= 0) return;

  parent.subtasks = Array.isArray(parent.subtasks) ? parent.subtasks : [];
  parent.subtasks.push({ id: crypto.randomUUID(), title, minutes, completed: false });
  saveTasks();
  hideSubtaskMenu();
  render();
}

// ============================================================================
// Grind mode
// ============================================================================

function renderGrindSubtasks(subtasks, isActive) {
  if (!Array.isArray(subtasks) || !subtasks.length) return '';
  return `<ul class="grind-subtask-list">${subtasks
    .map(
      (s) => `
      <li class="grind-subtask-item">
        <span class="task-duration">${getTaskMinutes(s)} min</span>
        <span class="grind-item-title">${s.title}</span>
        <input type="checkbox" data-check-subtask="${s.id}" ${s.completed ? 'checked' : ''} ${isActive ? '' : 'disabled'} />
      </li>
    `
    )
    .join('')}</ul>`;
}

function renderGrindBoard() {
  if (!state.grindMode) {
    elements.grindBoard.classList.add('hidden');
    elements.taskPanel.classList.remove('hidden');
    elements.listPanel.classList.remove('hidden');
    return;
  }

  const activeTask = getCurrentGrindTask();

  // Completed/total counted live from the snapshot of tasks in this
  // session, so checking a subtask box moves the bar immediately —
  // not just finishing a whole task.
  const sessionTasks = state.grindTaskIds.map((id) => findTaskNode(id)).filter(Boolean);
  const totalUnits = state.grindTotalUnits || 1;
  const completedUnits = sessionTasks.reduce((sum, t) => sum + countCompletedUnits(t), 0);
  const percent = Math.min(100, Math.round((completedUnits / totalUnits) * 100));

  elements.grindBoard.classList.remove('hidden');
  elements.taskPanel.classList.add('hidden');
  elements.listPanel.classList.add('hidden');
  elements.grindButton.disabled = !activeTask;
  elements.grindTaskName.textContent = activeTask ? activeTask.title : 'Task';

  // Build the segment state array once — it drives both the visual bar
  // and the literal code readout below, so they can never disagree.
  const segments = Array.from({ length: totalUnits }, (_, index) => {
    if (index < completedUnits) return 'done';
    if (index === completedUnits) return 'active';
    return 'pending';
  });

  const percentChanged = previousGrindPercent !== null && previousGrindPercent !== percent;

  elements.grindProgressPercent.textContent = `${percent}%`;
  elements.grindProgressTrackBg.style.width = `${percent}%`;
  elements.grindProgressFill.innerHTML = segments
    .map((segState) => `<div class="progress-segment ${segState}"></div>`)
    .join('');

  if (percentChanged) {
    elements.grindProgressPercent.classList.add('pulse');
    elements.grindProgressCode.classList.add('flash');
    window.setTimeout(() => {
      elements.grindProgressPercent.classList.remove('pulse');
      elements.grindProgressCode.classList.remove('flash');
    }, 300);
  }
  previousGrindPercent = percent;

  // Literally print the values driving the bar above, as they exist
  // right now, formatted as a JS object.
  elements.grindProgressCode.textContent =
    'progress = {\n' +
    `  totalUnits: ${totalUnits},\n` +
    `  completedUnits: ${completedUnits},\n` +
    `  percent: ${percent},\n` +
    `  segments: [${segments.map((s) => `'${s}'`).join(', ')}]\n` +
    '}';

  const minutes = Math.floor(state.grindTimerSeconds / 60);
  const seconds = state.grindTimerSeconds % 60;
  elements.grindTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  elements.grindPauseBtn.textContent = state.grindTimerId ? 'Pause' : 'Resume';

  elements.grindChecklist.innerHTML = state.tasks
    .map((task) => {
      const isActive = task.id === activeTask?.id;
      const checked = task.completed;
      const subtasksReady = !hasIncompleteSubtasks(task);
      return `
        <div class="grind-task-group ${checked ? 'done' : ''} ${isActive ? 'active' : ''}">
          <label class="check-item ${checked ? 'done' : ''}">
            <span class="task-duration">${getTaskMinutes(task)} min</span>
            <span class="grind-item-title">${task.title}</span>
            <input type="checkbox" data-check-task="${task.id}" ${checked ? 'checked' : ''} ${isActive && subtasksReady ? '' : 'disabled'} />
          </label>
          ${renderGrindSubtasks(task.subtasks, isActive)}
        </div>
      `;
    })
    .join('');

  bindGrindChecklistEvents(activeTask);
}

function bindGrindChecklistEvents(activeTask) {
  elements.grindChecklist.querySelectorAll('[data-check-subtask]').forEach((input) => {
    input.addEventListener('change', () => {
      const subtask = findTaskNode(input.dataset.checkSubtask);
      if (!subtask) return;
      subtask.completed = input.checked;
      saveTasks();
      render(); // progress bar updates right here, on a single subtask toggle
    });
  });

  elements.grindChecklist.querySelectorAll('[data-check-task]').forEach((input) => {
    input.addEventListener('change', () => {
      const selected = state.tasks.find((t) => t.id === input.dataset.checkTask);
      if (!selected || !input.checked) return;
      if (selected.id === activeTask?.id) completeCurrentTask();
    });
  });
}

function stopGrindTimer() {
  if (state.grindTimerId) {
    window.clearInterval(state.grindTimerId);
    state.grindTimerId = null;
  }
}

function startGrindTimer({ reset = true } = {}) {
  const activeTask = getCurrentGrindTask();
  if (!activeTask) return;
  stopGrindTimer();
  if (reset) state.grindTimerSeconds = getTaskMinutes(activeTask) * 60;

  state.grindTimerId = window.setInterval(() => {
    if (!state.grindMode) { stopGrindTimer(); return; }
    if (state.grindTimerSeconds > 0) {
      state.grindTimerSeconds -= 1;
      renderGrindBoard();
      return;
    }
    stopGrindTimer();
    render();
  }, 1000);
}

function pauseGrindTimer() {
  if (!state.grindMode) return;
  if (!state.grindTimerId) { startGrindTimer({ reset: false }); render(); return; }
  stopGrindTimer();
  render();
}

function resetGrindTimer() {
  const activeTask = getCurrentGrindTask();
  if (!activeTask) return;
  stopGrindTimer();
  state.grindTimerSeconds = getTaskMinutes(activeTask) * 60;
  startGrindTimer();
  render();
}

function extendGrindTimer() {
  if (!state.grindMode) return;
  state.grindTimerSeconds += 5 * 60;
  render();
}

function startGrind() {
  const unfinished = getUnfinishedTasks();
  if (!unfinished.length) return;

  state.grindMode = true;
  state.grindTaskIds = unfinished.map((t) => t.id);
  state.grindTotalUnits = unfinished.reduce((sum, t) => sum + countUnits(t), 0);
  state.selectedTaskId = unfinished[0].id;
  elements.startGrindBtn.disabled = true;
  startGrindTimer();
  render();
}

function completeCurrentTask() {
  const activeTask = getCurrentGrindTask();
  if (!activeTask) return;
  if (hasIncompleteSubtasks(activeTask)) { render(); return; }

  activeTask.completed = true;
  saveTasks();
  stopGrindTimer();

  const nextTask = getCurrentGrindTask();
  if (nextTask) {
    state.selectedTaskId = nextTask.id;
    startGrindTimer();
  } else {
    endGrindSession();
    render();
    removeCompletedTasks();
    return;
  }
  render();
}

function endGrindSession() {
  state.grindMode = false;
  state.grindTaskIds = [];
  state.grindTotalUnits = 0;
  state.grindTimerSeconds = 0;
  stopGrindTimer();
  elements.startGrindBtn.disabled = false;
}

function returnToHome() {
  endGrindSession();
  removeCompletedTasks();
  render();
}

// ============================================================================
// Render + bootstrap
// ============================================================================

// ============================================================================
// Background canvas animation
// ============================================================================

function initCanvasBackground() {
  const { resize } = canvasState;

  // Smoothed pointer position, eased toward the raw input each frame so the
  // parallax drift feels gentle rather than snapping to the cursor.
  let smoothX = 0.5;
  let smoothY = 0.5;

  startRenderLoop((time) => {
    const size = resize();
    const { context } = canvasState;

    smoothX = lerp(smoothX, pointer.normalizedX, 0.04);
    smoothY = lerp(smoothY, pointer.normalizedY, 0.04);

    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = 'rgba(0, 0, 0, 0.035)';

    const circleCount = 5;
    for (let i = 0; i < circleCount; i += 1) {
      const direction = i % 2 === 0 ? 1 : -1;
      const parallaxX = mapRange(smoothX, 0, 1, -30, 30) * direction;
      const parallaxY = mapRange(smoothY, 0, 1, -20, 20);

      const x = ((i + 1) / (circleCount + 1)) * size.width + parallaxX;
      const y = size.height * 0.35 + Math.sin(time / 900 + i) * 28 + parallaxY;
      const radius = clamp(54 + i * 20 + Math.sin(time / 700) * 10, 40, 160);

      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  });
}

// ============================================================================
// Render + bootstrap
// ============================================================================

function render() {
  renderTaskList();
  renderGrindBoard();
}

function bindEvents() {
  elements.taskForm.addEventListener('submit', handleTaskSubmit);
  elements.subtaskForm.addEventListener('submit', handleSubtaskSubmit);
  elements.closeSubtaskMenu.addEventListener('click', hideSubtaskMenu);
  document.addEventListener('click', (event) => {
    if (!elements.subtaskMenu.contains(event.target) && !event.target.closest('[data-add-sub]')) {
      hideSubtaskMenu();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideSubtaskMenu();
  });

  elements.startGrindBtn.addEventListener('click', startGrind);
  elements.grindPauseBtn.addEventListener('click', pauseGrindTimer);
  elements.grindResetBtn.addEventListener('click', resetGrindTimer);
  elements.grindExtendBtn.addEventListener('click', extendGrindTimer);
  elements.grindButton.addEventListener('click', completeCurrentTask);
  elements.backToHomeBtn.addEventListener('click', returnToHome);
}

function initialize() {
  syncSelection();
  bindEvents();
  initCanvasBackground();
  render();
}

initialize();