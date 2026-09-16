# Reusable Studio Engine Roadmap

## North Star

Build an interactive viewer for everyday objects that lets a person move from the familiar outside of an object to an understandable view of how it works inside.

The first experience will be a human hand. A slider along the bottom of the screen controls the reveal: at the start, the hand looks natural and intact; as the slider moves, its outer layers open to reveal the anatomy beneath.

## Definition of Done

The first release is complete when:

- A human hand is visible in a clear, centered starting state.
- A bottom slider can be dragged with a mouse, trackpad, keyboard, and touch.
- Slider progress maps continuously to the hand reveal instead of switching between fixed screens.
- The outer layers move aside or become transparent without losing the hand's orientation.
- Internal anatomy appears in a logical order and remains visually connected to the intact hand.
- The hand still reads clearly at the slider's starting, middle, and ending positions.
- The experience works on desktop and a narrow mobile viewport.

## Milestones

### 1. Project Foundation

Create the smallest working browser loop and establish the reusable boundaries.

- Add the page shell and canvas or rendering surface.
- Add the animation loop and a single source of truth for application state.
- Define a normalized reveal value from `0` (closed) to `1` (fully open).
- Add a basic bottom slider and connect its value to the render loop.
- Confirm the page loads without errors and the reveal value can be observed while dragging.

**Exit check:** moving the slider changes a visible test object continuously.

### 2. Intact Hand

Make the starting state readable before adding the internal anatomy.

- Draw or place the hand, fingers, palm, skin, and major external details.
- Establish scale, alignment, colors, and a stable coordinate system.
- Add a small amount of time or hand movement only if it supports understanding.
- Keep the object centered and legible across viewport sizes.

**Exit check:** with the slider at `0`, the subject immediately reads as a human hand.

### 3. Anatomical Model

Represent the inside as understandable anatomical layers rather than decorative noise.

- Choose the first set of visible structures: bones, joints, tendons, muscles, nerves, and blood vessels.
- Give every part a stable local position, size, and z-order.
- Define which parts are hidden, shown, or moved at each reveal stage.
- Use simple geometry first; replace it with richer artwork only after the motion is correct.

**Exit check:** the internal structures can be rendered independently from the outer skin layer.

### 4. Slider-Driven Anatomy Reveal

Turn the hand into one continuous anatomical explanation controlled by the user's hand.

- Map reveal progress to a sequence of meaningful anatomical transitions.
- Open, fade, or move the skin and tissue layers in a way that preserves spatial relationships.
- Reveal the internal structures in a deliberate order from surface anatomy to deeper anatomy.
- Keep the fingers, joints, and internal structures aligned so the user can understand their relationships.
- Clamp input and handle pointer, touch, and keyboard changes consistently.

**Exit check:** slowly dragging from left to right clearly exposes the hand's anatomy with no jumps, flicker, or broken alignment.

### 5. Interaction and Explanation Polish

Make the experience comfortable and self-explanatory without adding clutter.

- Add a visible slider handle, track, and progress state.
- Provide accessible labeling and keyboard focus behavior.
- Add restrained transitions for parts entering or leaving the scene.
- Add optional labels or callouts only where an anatomical structure is otherwise ambiguous.
- Handle resize, reduced-motion preference, and small screens.

**Exit check:** a first-time user can discover the interaction and operate it without instructions.

### 6. Reusable Subject Architecture

Extract the hand-specific work into a system that can support other everyday subjects.

- Define a subject interface for setup, rendering, input mapping, and reveal stages.
- Keep the slider and application loop independent from any one subject.
- Store subject layers and reveal behavior as data where practical.
- Make it possible to add a second subject without rewriting the core interaction.
- Document the lifecycle and conventions in the project README.

**Exit check:** a simple second subject can use the same slider, render loop, and viewport handling.

### 7. Validation and Release

Verify the experience as a user-facing interactive, not only as code.

- Test closed, half-open, and fully open states.
- Test slow drags, fast drags, clicking the track, keyboard arrows, and touch input.
- Test common desktop and mobile viewport sizes.
- Check for console errors, layout shifts, inaccessible controls, and performance issues.
- Capture screenshots of the key states for `process/screenshots/`.
- Record completed work and follow-up ideas in `process/changelog.md`.

**Exit check:** the charter's success test passes: sliding the bar opens the hand and shows its working anatomy.

## Suggested Build Order

1. Foundation and slider wiring
2. Intact hand silhouette
3. Internal anatomy geometry
4. Continuous anatomy reveal choreography
5. Responsive and accessible controls
6. Reusable object boundary
7. Validation, screenshots, and documentation

## Guardrails

- Prioritize clarity of motion over visual detail.
- Do not add assets or effects that make the mechanism harder to follow.
- Keep reveal progress continuous and reversible at all times.
- Preserve the user's spatial understanding: parts should not teleport without a clear reason.
- Build the first hand experience completely before expanding the subject library.
