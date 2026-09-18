import { startRenderLoop } from './src/Canvas/loop.js';
import { setupCanvas } from './src/Canvas/setupCanvas.js';

const STORAGE_KEY = 'reminder-app.tasks.v1';

const defaultTasks = [
  { id: crypto.randomUUID(), title: 'Read 20 minutes', minutes: 20, completed: false },
  { id: crypto.randomUUID(), title: 'Review notes', minutes: 10, completed: false },
];

const state = {
  tasks: loadTasks(),
  selectedTaskId: null,
  remainingSeconds: 25 * 60,
  isRunning: false,
  timerId: null,
  encouragement: 'You’ve got this. Pick a task and start when you’re ready.',
  grindMode: false,
  grindIndex: 0,
  grindSliderValue: 0,
  grindTimerSeconds: 0,
  grindTimerId: null,
  grindCanAdvance: false,
};

const elements = {
  taskForm: document.querySelector('#task-form'),
  taskName: document.querySelector('#task-name'),
  taskDuration: document.querySelector('#task-duration'),
  taskPanel: document.querySelector('.task-panel'),
  taskList: document.querySelector('#task-list'),
  listPanel: document.querySelector('.list-panel'),
  taskLabel: document.querySelector('#task-label'),
  statusPill: document.querySelector('#status-pill'),
  encouragement: document.querySelector('#encouragement'),
  minutes: document.querySelector('#minutes'),
  seconds: document.querySelector('#seconds'),
  startBtn: document.querySelector('#start-btn'),
  pauseBtn: document.querySelector('#pause-btn'),
  resetBtn: document.querySelector('#reset-btn'),
  extendBtn: document.querySelector('#extend-btn'),
  startGrindBtn: document.querySelector('#start-grind-btn'),
  grindBoard: document.querySelector('#grind-board'),
  grindTaskList: document.querySelector('#grind-task-list'),
  grindChecklist: document.querySelector('#grind-checklist'),
  grindStatus: document.querySelector('#grind-status'),
  grindTaskName: document.querySelector('#grind-task-name'),
  grindProgressLabel: document.querySelector('#grind-progress-label'),
  grindProgressFill: document.querySelector('#grind-progress-fill'),
  grindTimer: document.querySelector('#grind-timer'),
  grindPauseBtn: document.querySelector('#grind-pause-btn'),
  grindResetBtn: document.querySelector('#grind-reset-btn'),
  grindExtendBtn: document.querySelector('#grind-extend-btn'),
  grindButton: document.querySelector('#grind-button'),
  focusToggle: document.querySelector('#focus-toggle'),
  backToHomeBtn: document.querySelector('#back-to-home-btn'),
  subtaskMenu: document.querySelector('#subtask-menu'),
  subtaskForm: document.querySelector('#subtask-form'),
  subtaskName: document.querySelector('#subtask-name'),
  subtaskDuration: document.querySelector('#subtask-duration'),
  subtaskParentName: document.querySelector('#subtask-parent-name'),
  closeSubtaskMenu: document.querySelector('#close-subtask-menu'),
};

let draggedTaskId = null;
let subtaskParentId = null;

const canvas = document.querySelector('#bg-canvas');
const canvasState = setupCanvas(canvas);

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

function getTaskMinutes(task) {
  if (Array.isArray(task.subtasks) && task.subtasks.length) {
    return task.subtasks.reduce((total, subtask) => total + getTaskMinutes(subtask), 0);
  }

  return task.minutes;
}

function findTaskNode(taskId, tasks = state.tasks) {
  for (const task of tasks) {
    if (task.id === taskId) return task;
    const nestedTask = findTaskNode(taskId, task.subtasks ?? []);
    if (nestedTask) return nestedTask;
  }

  return null;
}

function getTaskSummary(task) {
  const minutes = getTaskMinutes(task);
  const subtaskCount = Array.isArray(task.subtasks) ? task.subtasks.length : 0;
  return subtaskCount ? `${minutes} min · ${subtaskCount} mini task${subtaskCount === 1 ? '' : 's'}` : `${minutes} min`;
}

function renderSubtaskDetails(subtasks) {
  if (!Array.isArray(subtasks) || !subtasks.length) return '';

  return `<details class="subtask-details"><summary>${subtasks.length} mini task${subtasks.length === 1 ? '' : 's'}</summary><ul class="subtask-list">${subtasks.map((subtask) => `
    <li data-subtask-id="${subtask.id}">
      <div class="subtask-heading-row">
        <span>${subtask.title}</span>
        <span class="task-duration">${getTaskMinutes(subtask)} min</span>
      </div>
      ${renderSubtaskDetails(subtask.subtasks)}
    </li>
  `).join('')}</ul></details>`;
}

function scheduleCompletedTaskRemoval(task) {
  if (state.grindMode) {
    saveTasks();
    render();
    return;
  }

  task.removing = true;
  saveTasks();
  render();

  window.setTimeout(() => {
    state.tasks = state.tasks.filter((candidate) => candidate.id !== task.id);
    saveTasks();
    syncSelection();
    render();
  }, 650);
}

function removeCompletedTasks() {
  const completedTasks = state.tasks.filter((task) => task.completed);
  if (!completedTasks.length) return;

  completedTasks.forEach((task) => {
    task.removing = true;
  });
  saveTasks();
  render();

  window.setTimeout(() => {
    state.tasks = state.tasks.filter((task) => !task.completed);
    saveTasks();
    syncSelection();
    render();
  }, 650);
}

function hasIncompleteSubtasks(task) {
  return Array.isArray(task.subtasks) && task.subtasks.some((subtask) => !subtask.completed || hasIncompleteSubtasks(subtask));
}

function getSelectedTask() {
  return state.tasks.find((task) => task.id === state.selectedTaskId) ?? state.tasks[0] ?? null;
}

function syncSelection() {
  if (!state.tasks.length) {
    state.selectedTaskId = null;
    state.remainingSeconds = 25 * 60;
    return;
  }

  if (!state.selectedTaskId || !state.tasks.some((task) => task.id === state.selectedTaskId)) {
    state.selectedTaskId = state.tasks[0].id;
  }

  const selected = getSelectedTask();
  if (selected) {
    state.remainingSeconds = getTaskMinutes(selected) * 60;
  }
}

function formatTime(totalSeconds) {
  const safeTotal = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeTotal / 60);
  const seconds = safeTotal % 60;

  return {
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

function setEncouragement(message) {
  state.encouragement = message;
  if (elements.encouragement) {
    elements.encouragement.textContent = message;
  }
}

function renderTimer() {
  if (!elements.minutes || !elements.seconds || !elements.taskLabel || !elements.statusPill || !elements.encouragement) {
    return;
  }

  const { minutes, seconds } = formatTime(state.remainingSeconds);
  elements.minutes.textContent = minutes;
  elements.seconds.textContent = seconds;

  const currentTask = getSelectedTask();
  if (currentTask) {
    elements.taskLabel.textContent = currentTask.title;
  } else {
    elements.taskLabel.textContent = 'No task selected';
  }

  elements.statusPill.textContent = state.isRunning ? 'Working' : 'Ready';
  elements.encouragement.textContent = state.encouragement;
}

function renderTaskList() {
  if (!state.tasks.length) {
    elements.taskList.innerHTML = '<li class="empty-state">No tasks yet. Add one to begin.</li>';
    return;
  }

  elements.taskList.innerHTML = state.tasks
    .map((task) => {
      const activeClass = task.id === state.selectedTaskId ? 'selected' : '';
      const removingClass = task.removing ? 'removing' : '';
      const statusText = task.completed ? 'Done' : getTaskSummary(task);
      const subtasks = renderSubtaskDetails(task.subtasks);

      return `
        <li class="task-item ${activeClass} ${removingClass}" data-task-id="${task.id}">
          <div class="task-content">
            <div class="task-heading-row">
              <button type="button" class="task-select" data-task-id="${task.id}">${task.title}</button>
              <span class="task-duration">${statusText}</span>
            </div>
            ${subtasks}
          </div>
          <div class="task-meta">
            <button type="button" class="tiny-btn" data-delete-id="${task.id}">Delete</button>
          </div>
        </li>
      `;
    })
    .join('');

  const items = elements.taskList.querySelectorAll('.task-select');
  items.forEach((button) => {
    button.addEventListener('click', () => {
      const { taskId } = button.dataset;
      state.selectedTaskId = taskId;
      const selectedTask = getSelectedTask();
      if (selectedTask) {
        state.remainingSeconds = getTaskMinutes(selectedTask) * 60;
        state.isRunning = false;
        clearInterval(state.timerId);
        state.timerId = null;
      }
      render();
    });
  });

  elements.taskList.querySelectorAll('[data-subtask-id]').forEach((subtask) => {
    subtask.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showSubtaskMenu(subtask.dataset.subtaskId, event.clientX, event.clientY);
    });
  });

  items.forEach((button) => {
    button.closest('.task-item').addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showSubtaskMenu(button.dataset.taskId, event.clientX, event.clientY);
    });
  });

  elements.taskList.querySelectorAll('.task-item').forEach((item) => {
    item.draggable = true;
    item.addEventListener('dragstart', () => {
      draggedTaskId = item.dataset.taskId;
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      draggedTaskId = null;
      item.classList.remove('dragging');
    });
    item.addEventListener('dragover', (event) => event.preventDefault());
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      reorderTasks(draggedTaskId, item.dataset.taskId);
    });
  });

  const deleteButtons = elements.taskList.querySelectorAll('[data-delete-id]');
  deleteButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = button.dataset.deleteId;
      state.tasks = state.tasks.filter((task) => task.id !== id);
      saveTasks();
      syncSelection();
      render();
    });
  });
}

function reorderTasks(sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return;
  const sourceIndex = state.tasks.findIndex((task) => task.id === sourceId);
  const targetIndex = state.tasks.findIndex((task) => task.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;

  const [movedTask] = state.tasks.splice(sourceIndex, 1);
  state.tasks.splice(targetIndex, 0, movedTask);
  saveTasks();
  renderTaskList();
}

function showSubtaskMenu(taskId, x, y) {
  const task = findTaskNode(taskId);
  if (!task) return;

  subtaskParentId = taskId;
  elements.subtaskParentName.textContent = task.title;
  elements.subtaskMenu.classList.remove('hidden');
  const menuWidth = 260;
  const menuHeight = 150;
  elements.subtaskMenu.style.left = `${Math.min(x, window.innerWidth - menuWidth - 12)}px`;
  elements.subtaskMenu.style.top = `${Math.min(y, window.innerHeight - menuHeight - 12)}px`;
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
  parent.minutes = getTaskMinutes(parent);
  saveTasks();
  hideSubtaskMenu();
  syncSelection();
  render();
}

function getUnfinishedTasks() {
  return state.tasks.filter((task) => !task.completed);
}

function getNextIncompleteTask(fromTaskId = null) {
  const unfinished = getUnfinishedTasks();
  if (!unfinished.length) return null;

  if (!fromTaskId) return unfinished[0];

  const currentIndex = unfinished.findIndex((task) => task.id === fromTaskId);
  return unfinished[currentIndex + 1] ?? null;
}

function getCurrentGrindTask() {
  const unfinished = getUnfinishedTasks();
  return unfinished[0] ?? null;
}

function renderGrindBoard() {
  const unfinished = getUnfinishedTasks();

  if (!state.grindMode) {
    elements.grindBoard.classList.add('hidden');
    elements.taskPanel.classList.remove('hidden');
    elements.listPanel.classList.remove('hidden');
    return;
  }

  const activeTask = getCurrentGrindTask();
  const totalTasks = state.tasks.length || 1;
  const completedCount = state.tasks.filter((task) => task.completed).length;
  const percent = Math.min(100, Math.round((completedCount / totalTasks) * 100));

  elements.grindBoard.classList.remove('hidden');
  elements.taskPanel.classList.add('hidden');
  elements.listPanel.classList.add('hidden');
  if (elements.grindButton) elements.grindButton.disabled = !activeTask;
  elements.grindTaskName.textContent = activeTask ? activeTask.title : 'Task';
  elements.grindProgressLabel.textContent = `${percent}%`;
  elements.grindProgressFill.style.width = `${percent}%`;

  const minutes = Math.floor(state.grindTimerSeconds / 60);
  const seconds = state.grindTimerSeconds % 60;
  elements.grindTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (elements.grindPauseBtn) {
    elements.grindPauseBtn.textContent = state.grindTimerId ? 'Pause' : 'Resume';
  }

  elements.grindChecklist.innerHTML = state.tasks
    .map((task) => {
      const isActive = task.id === activeTask?.id;
      const checked = task.completed;
      const subtasksReady = !hasIncompleteSubtasks(task);
      const subtasks = renderGrindSubtasks(task.subtasks, isActive);
      return `
        <div class="grind-task-group ${checked ? 'done' : ''} ${task.removing ? 'removing' : ''} ${isActive ? 'active' : ''}">
          <label class="check-item">
            <input type="checkbox" data-check-task="${task.id}" ${checked ? 'checked' : ''} ${isActive && subtasksReady ? '' : 'disabled'} />
            <span>${task.title}</span>
          </label>
          ${subtasks}
        </div>
      `;
    })
    .join('');

  elements.grindChecklist.querySelectorAll('[data-check-subtask]').forEach((input) => {
    input.addEventListener('change', () => {
      const subtask = findTaskNode(input.dataset.checkSubtask);
      if (!subtask) return;
      subtask.completed = input.checked;
      saveTasks();
      render();
    });
  });

  elements.grindChecklist.querySelectorAll('[data-check-task]').forEach((input) => {
    input.addEventListener('change', () => {
      const { checkTask } = input.dataset;
      const selected = state.tasks.find((task) => task.id === checkTask);
      if (!selected || !input.checked) return;
      if (selected.id === activeTask?.id || selected.completed) {
        completeCurrentTask();
      }
    });
  });

  if (elements.grindStatus) {
    if (state.grindCanAdvance) {
      elements.grindStatus.textContent = 'You can move on now or click I’m done.';
    } else {
      elements.grindStatus.textContent = 'Finish the current task to keep moving.';
    }
  }
}

function renderGrindSubtasks(subtasks, isActive) {
  if (!Array.isArray(subtasks) || !subtasks.length) return '';

  return `<ul class="grind-subtask-list">${subtasks.map((subtask) => `
    <li>
      <label class="grind-subtask-item">
        <input type="checkbox" data-check-subtask="${subtask.id}" ${subtask.completed ? 'checked' : ''} ${isActive ? '' : 'disabled'} />
        <span>${subtask.title}</span>
        <span>${getTaskMinutes(subtask)} min</span>
      </label>
      ${renderGrindSubtasks(subtask.subtasks, isActive)}
    </li>
  `).join('')}</ul>`;
}

function render() {
  renderTaskList();
  renderTimer();
  renderGrindBoard();
}

function startTimer() {
  if (!getSelectedTask()) return;

  state.isRunning = true;
  setEncouragement('Keep going — you are doing enough.');
  clearInterval(state.timerId);

  state.timerId = window.setInterval(() => {
    if (state.remainingSeconds > 0) {
      state.remainingSeconds -= 1;
      renderTimer();
    } else {
      clearInterval(state.timerId);
      state.timerId = null;
      state.isRunning = false;

      const currentTask = getSelectedTask();
      if (currentTask) {
        currentTask.completed = true;
        scheduleCompletedTaskRemoval(currentTask);
      }

      setEncouragement('Nice work. Take a quick break, or add a little more time if you need it.');
      render();
    }
  }, 1000);

  renderTimer();
}

function pauseTimer() {
  state.isRunning = false;
  clearInterval(state.timerId);
  state.timerId = null;
  setEncouragement('Take a breath. You can restart when you’re ready.');
  renderTimer();
}

function resetTimer() {
  pauseTimer();
  const currentTask = getSelectedTask();
  if (currentTask) {
    state.remainingSeconds = getTaskMinutes(currentTask) * 60;
  }
  setEncouragement('Reset and start fresh. You do not need to rush.');
  renderTimer();
}

function extendTimer() {
  state.remainingSeconds += 5 * 60;
  setEncouragement('More time is allowed. You can keep going at your own pace.');
  renderTimer();
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const title = elements.taskName.value.trim();
  const minutes = Number(elements.taskDuration.value);

  if (!title || !Number.isFinite(minutes) || minutes <= 0) return;

  const newTask = {
    id: crypto.randomUUID(),
    title,
    minutes,
    completed: false,
  };

  state.tasks.unshift(newTask);
  state.selectedTaskId = newTask.id;
  state.remainingSeconds = minutes * 60;
  state.isRunning = false;
  saveTasks();
  elements.taskForm.reset();
  elements.taskDuration.value = 25;
  render();
}

function stopGrindTimer() {
  if (state.grindTimerId) {
    window.clearInterval(state.grindTimerId);
    state.grindTimerId = null;
  }
}

function pauseGrindTimer() {
  if (!state.grindMode) return;

  if (!state.grindTimerId) {
    setEncouragement('Timer resumed. Keep going at your own pace.');
    startGrindTimer({ reset: false });
    render();
    return;
  }

  stopGrindTimer();
  state.grindCanAdvance = false;
  setEncouragement('Timer paused. Restart when you are ready.');
  render();
}

function resetGrindTimer() {
  const activeTask = getCurrentGrindTask();
  if (!activeTask) return;
  stopGrindTimer();
  state.grindTimerSeconds = getTaskMinutes(activeTask) * 60;
  state.grindCanAdvance = false;
  setEncouragement('Reset and start fresh. You do not need to rush.');
  startGrindTimer();
  render();
}

function extendGrindTimer() {
  if (!state.grindMode) return;
  state.grindTimerSeconds += 5 * 60;
  state.grindCanAdvance = false;
  setEncouragement('More time is allowed. Keep going at your own pace.');
  render();
}

function startGrindTimer({ reset = true } = {}) {
  const activeTask = getCurrentGrindTask();
  if (!activeTask) return;

  stopGrindTimer();
  if (reset) {
    state.grindTimerSeconds = getTaskMinutes(activeTask) * 60;
  }
  state.grindCanAdvance = false;

  state.grindTimerId = window.setInterval(() => {
    if (!state.grindMode) {
      stopGrindTimer();
      return;
    }

    if (state.grindTimerSeconds > 0) {
      state.grindTimerSeconds -= 1;
      renderGrindBoard();
      return;
    }

    stopGrindTimer();
    state.grindCanAdvance = true;
    setEncouragement('That task is complete. You can move the slider now or tap “I’m done”.');
    render();
  }, 1000);
}

function startGrind() {
  const unfinished = getUnfinishedTasks();
  if (!unfinished.length) {
    setEncouragement('Add a task before you start the grind.');
    return;
  }

  state.grindMode = true;
  state.grindIndex = 0;
  state.grindSliderValue = 0;
  state.selectedTaskId = unfinished[0].id;
  if (elements.startGrindBtn) elements.startGrindBtn.disabled = true;
  startGrindTimer();
  setEncouragement('Start the grind. Finish the timer to unlock the next task.');
  render();
}

function completeCurrentTask() {
  const activeTask = getCurrentGrindTask();
  if (!activeTask) return;

  if (hasIncompleteSubtasks(activeTask)) {
    setEncouragement('Check off every mini task before finishing this task.');
    render();
    return;
  }

  activeTask.completed = true;
  scheduleCompletedTaskRemoval(activeTask);
  stopGrindTimer();

  const nextTask = getNextIncompleteTask(activeTask.id);
  state.grindIndex += 1;

  if (nextTask) {
    state.selectedTaskId = nextTask.id;
    state.grindSliderValue = state.grindIndex;
    state.grindCanAdvance = false;
    startGrindTimer();
    setEncouragement('Nice work. The next task is ready.');
  } else {
    state.grindMode = false;
    state.grindIndex = 0;
    state.grindSliderValue = 0;
    state.grindCanAdvance = false;
    state.grindTimerSeconds = 0;
    stopGrindTimer();
    if (elements.startGrindBtn) elements.startGrindBtn.disabled = false;
    setEncouragement('All tasks complete. Beautiful work. Take a breath.');
    render();
    removeCompletedTasks();
    return;
  }

  render();
}

function returnToHome() {
  state.grindMode = false;
  state.grindIndex = 0;
  state.grindSliderValue = 0;
  state.grindCanAdvance = false;
  state.grindTimerSeconds = 0;
  stopGrindTimer();
  if (elements.startGrindBtn) elements.startGrindBtn.disabled = false;
  removeCompletedTasks();
  setEncouragement('Back to your task list. Keep going at your own pace.');
  render();
}

function setFocusMode() {
  document.body.classList.toggle('focus-mode');
  elements.focusToggle.textContent = document.body.classList.contains('focus-mode') ? 'Normal view' : 'Focus mode';
}

function initCanvasBackground() {
  const { resize } = canvasState;

  startRenderLoop((time) => {
    const size = resize();
    const { context } = canvasState;
    const wave = Math.sin(time / 700);

    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = 'rgba(255, 255, 255, 0.08)';

    for (let i = 0; i < 5; i += 1) {
      const x = ((i + 1) / 6) * size.width;
      const y = size.height * 0.35 + Math.sin(time / 900 + i) * 28;
      const radius = 54 + i * 20 + wave * 10;

      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function bindEvents() {
  if (elements.taskForm) elements.taskForm.addEventListener('submit', handleTaskSubmit);
  if (elements.subtaskForm) elements.subtaskForm.addEventListener('submit', handleSubtaskSubmit);
  if (elements.closeSubtaskMenu) elements.closeSubtaskMenu.addEventListener('click', hideSubtaskMenu);
  document.addEventListener('click', (event) => {
    if (!elements.subtaskMenu.contains(event.target)) hideSubtaskMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideSubtaskMenu();
  });
  if (elements.startBtn) elements.startBtn.addEventListener('click', startTimer);
  if (elements.pauseBtn) elements.pauseBtn.addEventListener('click', pauseTimer);
  if (elements.resetBtn) elements.resetBtn.addEventListener('click', resetTimer);
  if (elements.extendBtn) elements.extendBtn.addEventListener('click', extendTimer);
  if (elements.startGrindBtn) elements.startGrindBtn.addEventListener('click', startGrind);
  if (elements.grindPauseBtn) elements.grindPauseBtn.addEventListener('click', pauseGrindTimer);
  if (elements.grindResetBtn) elements.grindResetBtn.addEventListener('click', resetGrindTimer);
  if (elements.grindExtendBtn) elements.grindExtendBtn.addEventListener('click', extendGrindTimer);
  if (elements.grindButton) elements.grindButton.addEventListener('click', completeCurrentTask);
  if (elements.backToHomeBtn) elements.backToHomeBtn.addEventListener('click', returnToHome);
  if (elements.focusToggle) elements.focusToggle.addEventListener('click', setFocusMode);
}

function initialize() {
  syncSelection();
  bindEvents();
  initCanvasBackground();
  render();
}

initialize();
