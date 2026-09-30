'use strict';
// First-run tour. The first time the app opens it highlights, one at a time,
// the things to use in order:
//   1. the Add a task box
//   2. the + mini button on a task
//   3. the Blocked sites button
//   4. the GRIND button
//
// Each step moves on by itself when you do the thing (add a task, close the
// mini task popup, close the blocked sites panel, press GRIND). Next and
// Skip tour are always there too. The ? button in the header replays it.
//
// To change the tour, edit STEPS below.

(() => {
  const DONE_KEY = 'reminder-app.tourDone.v1';

  const $ = (selector) => document.querySelector(selector);
  const isShown = (el) => !!el && !el.classList.contains('hidden');
  const taskCount = () => document.querySelectorAll('#task-list .task-item').length;

  // Anything a step needs to remember while it is showing.
  let memo = {};

  const STEPS = [
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
      title: 'Pick what gets blocked',
      resolve() {
        if (isShown($('#settings-panel'))) {
          return {
            // The panel is taller than the window, so point at its button row;
            // the card then sits above the buttons instead of covering them.
            target: $('#settings-panel .settings-actions'),
            badge: 'SAVE OR CLOSE',
            text: 'Block closes a site the moment you open it. Check-in lets it stay open, then asks if you are being productive. Press Edit list to change them, then Save and Close.',
          };
        }
        return {
          target: $('#settings-btn'),
          badge: 'CLICK HERE',
          text: 'Blocked sites lets you choose which websites get shut down while GRIND is running. Press it to see the list.',
        };
      },
      shouldAdvance() {
        const open = isShown($('#settings-panel'));
        if (open) memo.panelSeen = true;
        return !!memo.panelSeen && !open;
      },
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

  // ---------- remembering that the tour was seen ----------

  async function wasSeen() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const saved = await chrome.storage.local.get(DONE_KEY);
        return !!saved[DONE_KEY];
      }
      return localStorage.getItem(DONE_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  async function markSeen() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [DONE_KEY]: true });
      } else {
        localStorage.setItem(DONE_KEY, '1');
      }
    } catch (error) {
      // Not being able to save just means the tour may show again.
    }
  }

  // ---------- on-screen pieces ----------

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
    ui.next.addEventListener('click', () => goTo(stepIndex + 1));

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

  function setHighlight(el) {
    highlighted = el;
  }

  function clearHighlight() {
    highlighted = null;
  }

  function moveSpotlight(el, rect) {
    const pad = 6;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    spotlight.style.top = rect.top - pad + 'px';
    spotlight.style.left = rect.left - pad + 'px';
    spotlight.style.width = rect.width + pad * 2 + 'px';
    spotlight.style.height = rect.height + pad * 2 + 'px';
    spotlight.style.borderRadius = radius + pad + 'px';
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
    const step = STEPS[stepIndex];
    const { target, text, badge: badgeText } = step.resolve();

    if (!target || target.getBoundingClientRect().width === 0) {
      goTo(stepIndex + 1); // nothing to point at (e.g. GRIND already running)
      return;
    }

    const key = stepIndex + '|' + text;
    if (key !== shownKey) {
      shownKey = key;
      ui.label.textContent = 'Step ' + (stepIndex + 1) + ' of ' + STEPS.length;
      ui.title.textContent = step.title;
      ui.text.textContent = text;
      badge.textContent = badgeText || 'LOOK HERE';
      ui.next.textContent = stepIndex === STEPS.length - 1 ? 'Got it' : 'Next';
    }

    if (target !== highlighted) {
      setHighlight(target);
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
    if (STEPS[stepIndex].shouldAdvance()) {
      goTo(stepIndex + 1);
    }
    if (active) {
      render();
      frameId = requestAnimationFrame(frame);
    }
  }

  function goTo(index) {
    if (index >= STEPS.length) {
      finish();
      return;
    }
    stepIndex = index;
    memo = {};
    shownKey = '';
    if (STEPS[stepIndex].onEnter) STEPS[stepIndex].onEnter();
  }

  function start() {
    if (active) return;
    active = true;
    buildCard();
    goTo(0);
    frame();
  }

  function finish() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frameId);
    clearHighlight();
    if (overlay) overlay.remove();
    overlay = card = spotlight = badge = null;
    ui = {};
    markSeen();
  }

  // Pressing GRIND at any point means they are off and running.
  document.addEventListener('click', (event) => {
    if (active && event.target instanceof Element && event.target.closest('#start-grind-btn')) {
      finish();
    }
  }, true);

  // The ? button replays the tour.
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('#help-btn')) {
      start();
    }
  });

  window.Onboarding = {
    async startIfFirstRun() {
      if (!(await wasSeen())) start();
    },
    replay: start,
  };
})();