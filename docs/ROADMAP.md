# Reminder App Roadmap

## North Star
The app should help people complete tasks with less stress and more momentum by acting like a playful, supportive guide rather than a punitive timer or cold productivity tool.

## Core Product Principles
From the system charter:
- Help users stay focused and remember what matters
- Support real-life busy people, especially students and everyday task-heavy users
- Reduce shame and stress: timers should be flexible, forgiving, and encouraging
- Keep the experience engaging and fun, not sterile or intimidating
- Respect privacy and avoid intrusive data collection
- Avoid the blandness of a default phone reminder app
- Prefer a warm, animated, motivating atmosphere over a dark, cold, pushy interface

## Product Direction
This app is not a generic calendar or reminder clone. It should feel like an encouraging productivity companion that:
- creates clear task flow and time awareness
- offers flexible timing instead of rigid punishment
- gives users control to extend work windows when needed
- uses animation and personality to increase momentum
- avoids pressure-heavy design cues

## Roadmap

### Phase 1: Foundation and Core Loop
Goal: establish the actual reminder/timing experience.

Tasks:
- Define the base task model: title, duration, notes, repeat status, completion state
- Build a simple task creation flow
- Add timer state management for work, break, and extension logic
- Keep the app in a lightweight single-page structure
- Confirm the app works cleanly in the browser without unnecessary complexity

Success criteria:
- User can create a task and start a timer
- User can extend time without friction
- Task flow feels calm and supportive rather than punitive

### Phase 2: Behavior Change Features
Goal: make the app feel helpful instead of oppressive.

Tasks:
- Add “need more time?” behavior that makes extending a timer feel humane
- Add break suggestions after focused work sessions
- Add small motivational nudges in the UI rather than aggressive notifications
- Add completion states that reinforce progress instead of guilt

Success criteria:
- User feels guided, not monitored
- Timer behavior supports productivity without shame
- Breaks are treated as part of the workflow, not as failure

### Phase 3: Personality and Atmosphere
Goal: make the app visually and emotionally engaging.

Tasks:
- Choose a warm, non-templety visual palette
- Use motion and animation sparingly to feel lively and energetic
- Design for a playful, encouraging tone
- Maintain clarity and accessibility in all states
- Avoid UI that feels cold, dark, or overly demanding

Success criteria:
- The interface feels alive and motivating
- The look is distinct from a generic reminder app
- The atmosphere supports the app’s dignity-first thesis

### Phase 4: Task Workflow and Focus Support
Goal: support the rhythm of real daily work.

Tasks:
- Add multi-task awareness without clutter
- Let users focus on one task at a time while still seeing progress
- Add short daily/task summaries or progress feedback
- Support realistic use cases such as students, busy workers, and general daily task flow

Success criteria:
- The app supports real-life planning without becoming overloaded
- The user can understand their day quickly
- Focus remains on doing work, not managing complex settings

### Phase 5: Polish, Accessibility, and Trust
Goal: make the application feel stable and respectful.

Tasks:
- Review UX for stress reduction and dignity
- Improve accessibility for contrast, readability, and interaction clarity
- Ensure no intrusive tracking or privacy violations
- Remove any feature that feels manipulative or attention-grabbing
- Confirm the app stays friendly and not coercive

Success criteria:
- The app feels safe and respectful to use
- It remains engaging without becoming exploitative
- It remains simple enough for regular users

## Implementation Guardrails
These are non-negotiables for future work:
- No forced attention tactics or manipulative UI patterns
- No privacy-invasive features such as photo capture, location tracking, or data mining
- No dark blue-on-black aesthetic that feels cold or templated
- No “strict boss” timer behavior that shames users when they need flexibility
- Keep the experience supportive, human, and motivating

## Recommended Order of Work
1. Task creation and timer core
2. Flexible time extension behavior
3. Break logic and motivational feedback
4. Personality/visual design pass
5. Workflow polish and accessibility
6. Final quality review against the charter

## Definition of Done
A feature is ready when:
- it aligns with the system charter
- it reduces friction instead of creating shame
- it is understandable and enjoyable to use
- it supports focus without being intrusive
- it feels like a positive guide, not a strict monitor
