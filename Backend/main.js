function renderGrindBoard() {
  if (!state.grindMode) {
    elements.grindBoard.classList.add('hidden');
    elements.taskPanel.classList.remove('hidden');
    elements.listPanel.classList.remove('hidden');

    return;
  }

  const activeTask = getCurrentGrindTask();

  const sessionTasks =
    state.grindTaskIds
      .map((id) => findTaskNode(id))
      .filter(Boolean);

  const totalUnits =
    state.grindTotalUnits || 1;

  const completedUnits =
    sessionTasks.reduce(
      (sum, t) => sum + countCompletedUnits(t),
      0
    );

  const percent =
    Math.min(
      100,
      Math.round(
        (completedUnits / totalUnits) * 100
      )
    );

  elements.grindBoard.classList.remove('hidden');
  elements.taskPanel.classList.add('hidden');
  elements.listPanel.classList.add('hidden');

  elements.grindButton.disabled = !activeTask;

  elements.grindTaskName.textContent =
    activeTask
      ? activeTask.title
      : 'Task';

  elements.grindProgressPercent.textContent =
    `${percent}%`;

  // ONE continuous progress bar.
  elements.grindProgressFill.style.width =
    `${percent}%`;

  const minutes =
    Math.floor(
      state.grindTimerSeconds / 60
    );

  const seconds =
    state.grindTimerSeconds % 60;

  elements.grindTimer.textContent =
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  elements.grindPauseBtn.textContent =
    state.grindTimerId
      ? 'Pause'
      : 'Resume';

  // ...rest of your existing checklist code...
}