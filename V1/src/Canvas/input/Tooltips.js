'use strict';
// Hover descriptions. Hover (or pause on) any button or field and a small
// box explains what it does.
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

  document.addEventListener('mouseover', (event) => {
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