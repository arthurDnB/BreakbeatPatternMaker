/** Compact controls for the generator's existing range inputs.
 *
 * The native inputs remain in the document and remain the source of truth. The
 * dial only writes to them and emits ordinary input/change events, so existing
 * generator listeners and project serialization keep working.
 */

const explanations: Record<string, string> = {
  'bpm-slider': 'Sets the pattern tempo in beats per minute. Drag vertically to adjust; hold Shift for fine changes.',
  complexity: 'Adds rhythmic detail and busier phrases as you turn it up.',
  spicy: 'Adds more rolls, accents, and variation to generated beats.',
  reverseProbability: 'Chance that a generated sample note plays backward. Manual notes and synth notes are unaffected.',
  pianoLushness: 'Opens the chord voicing and smooths the movement between chords.',
  pianoTension: 'Adds colorful jazz extensions and altered tones to piano chords.',
  pianoDensity: 'Sets how many piano chord voices and comping answers are used.',
  'hit-target-slider': 'Sets the exact number of generated drum notes when Exact mode is on. Ratchets count once.',
  syncopation: 'Moves more hits off the strong beats for a less rigid groove.',
  swing: 'Delays alternating subdivisions. 0.50 is straight; higher values swing.',
  humanizeMs: 'Adds small timing variations in milliseconds to generated hits.',
  ghostAmount: 'Controls the amount of quiet supporting drum hits.',
  fillAmount: 'Sets how often the generator adds a fill or transition.',
  'kick-density': 'Controls how many kick hits the generator makes relative to the genre default.',
  'snare-density': 'Controls how many snare hits the generator makes relative to the genre default.',
  'hat-density': 'Controls how many hi-hat hits the generator makes relative to the genre default.',
  'percussion-density': 'Controls how many percussion hits the generator makes relative to the genre default.',
};

function formattedValue(input: HTMLInputElement): string {
  const number = Number(input.value);
  if (input.id === 'bpm-slider') return `${number.toFixed(1)} BPM`;
  if (input.id === 'humanizeMs') return `${number} ms`;
  if (input.id === 'hit-target-slider') return `${number} hits`;
  if (input.id === 'swing' || input.id === 'syncopation' || input.id === 'ghostAmount' || input.id === 'fillAmount') return number.toFixed(2);
  if (Number(input.max) <= 2) return `${Math.round(number * 100)}%`;
  return input.value;
}

function syncKnob(input: HTMLInputElement): void {
  const shell = input.closest<HTMLElement>('.gen-knob-shell');
  const dial = shell?.querySelector<HTMLElement>('.gen-knob-dial');
  if (!shell || !dial) return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const current = Number(input.value);
  const fraction = max > min ? Math.max(0, Math.min(1, (current - min) / (max - min))) : 0;
  shell.style.setProperty('--gen-knob-angle', `${-135 + fraction * 270}deg`);
  dial.setAttribute('aria-valuemin', String(min));
  dial.setAttribute('aria-valuemax', String(max));
  dial.setAttribute('aria-valuenow', input.value);
  dial.setAttribute('aria-valuetext', formattedValue(input));
  dial.setAttribute('aria-disabled', String(input.disabled));
  dial.tabIndex = input.disabled ? -1 : 0;
  shell.classList.toggle('gen-knob-disabled', input.disabled);
  const indicator = shell.querySelector<HTMLElement>('.gen-knob-indicator');
  if (indicator) indicator.setAttribute('aria-hidden', 'true');
}

function setValue(input: HTMLInputElement, value: number): void {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = input.step === 'any' ? (max - min) / 100 : Number(input.step || 1);
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const decimals = (String(safeStep).split('.')[1] ?? '').length;
  const snapped = Math.min(max, Math.max(min, min + Math.round((value - min) / safeStep) * safeStep));
  const next = snapped.toFixed(Math.min(10, decimals));
  if (input.value === next) return;
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  syncKnob(input);
}

function enhance(input: HTMLInputElement): void {
  if (!input.id || input.closest('.gen-knob-shell')) return;
  const label = document.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`)?.textContent?.replace(/\s+/g, ' ').trim()
    || input.getAttribute('aria-label') || input.id;
  input.classList.add('gen-knob-source');
  // The visible dial owns keyboard and screen-reader interaction. Keep the
  // original range as the value source without adding a second tab stop.
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  const shell = document.createElement('span');
  shell.className = 'gen-knob-shell';
  shell.dataset.knobId = input.id;
  const dial = document.createElement('span');
  dial.className = 'gen-knob-dial';
  dial.dataset.for = input.id;
  dial.setAttribute('role', 'slider');
  dial.setAttribute('aria-label', input.getAttribute('aria-label') || label);
  dial.setAttribute('aria-orientation', 'vertical');
  const indicator = document.createElement('span');
  indicator.className = 'gen-knob-indicator';
  dial.append(indicator);
  const tooltip = document.createElement('span');
  tooltip.className = 'gen-knob-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.textContent = `${label}: ${explanations[input.id] || 'Drag to adjust this generator setting. Hold Shift for fine changes.'}`;
  tooltip.id = `gen-knob-help-${input.id}`;
  dial.setAttribute('aria-describedby', tooltip.id);
  input.parentNode?.insertBefore(shell, input);
  shell.append(input, dial);
  // The generator tray scrolls and clips its children. A fixed tooltip in the
  // body stays visible even for knobs near the tray's edge.
  document.body.append(tooltip);
  let suppressHelp = false;
  const hideTooltip = () => tooltip.classList.remove('is-visible');
  const showTooltip = () => {
    if (input.disabled || suppressHelp) return;
    tooltip.classList.add('is-visible');
    const rect = shell.getBoundingClientRect();
    const width = tooltip.offsetWidth || 240;
    const height = tooltip.offsetHeight || 56;
    // The value is immediately above the dial. Put help beside it where there
    // is room, then below it on narrow screens so that readout stays visible.
    const right = rect.right + 10;
    const left = rect.left - width - 10;
    const sideTop = Math.max(8, Math.min(window.innerHeight - height - 8, rect.top + rect.height / 2 - height / 2));
    const readout = shell.closest('.gen-slider-block, .gen-tempo-module')?.querySelector('output, input[type="number"]')?.getBoundingClientRect();
    const clearOfReadout = (x: number) => !readout || x + width <= readout.left || x >= readout.right || sideTop + height <= readout.top || sideTop >= readout.bottom;
    const beside = right + width <= window.innerWidth - 8 && clearOfReadout(right) ? right : left >= 8 && clearOfReadout(left) ? left : null;
    tooltip.style.left = `${beside ?? Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))}px`;
    tooltip.style.top = `${beside === null ? Math.max(8, Math.min(window.innerHeight - height - 8, rect.bottom + 8)) : sideTop}px`;
  };
  shell.addEventListener('pointerenter', showTooltip);
  shell.addEventListener('pointerleave', () => {
    suppressHelp = false;
    hideTooltip();
  });
  shell.addEventListener('focusin', showTooltip);
  shell.addEventListener('focusout', () => queueMicrotask(() => {
    if (!shell.contains(document.activeElement)) {
      suppressHelp = false;
      hideTooltip();
    }
  }));
  window.addEventListener('scroll', hideTooltip, { capture: true, passive: true });
  window.addEventListener('resize', hideTooltip);

  let drag: { startX: number; startY: number; startValue: number; changed: boolean } | null = null;
  // The native input is visually overlaid on the dial so browser automation
  // and labels can still target it. Capture first, before the browser's range
  // click behavior, and use the same vertical gesture from either target.
  shell.addEventListener('pointerdown', (event) => {
    if (input.disabled || event.button !== 0) return;
    event.preventDefault();
    suppressHelp = true;
    hideTooltip();
    dial.focus();
    drag = { startX: event.clientX, startY: event.clientY, startValue: Number(input.value), changed: false };
    shell.setPointerCapture(event.pointerId);
    shell.classList.add('gen-knob-dragging');
  }, { capture: true });
  shell.addEventListener('pointermove', (event) => {
    if (!drag || input.disabled) return;
    const before = input.value;
    const range = Number(input.max) - Number(input.min);
    const dx = event.clientX - drag.startX;
    const dy = drag.startY - event.clientY;
    const movement = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    setValue(input, drag.startValue + movement * range / (event.shiftKey ? 800 : 160));
    drag.changed ||= before !== input.value;
  });
  const endDrag = () => {
    if (drag?.changed) input.dispatchEvent(new Event('change', { bubbles: true }));
    drag = null;
    shell.classList.remove('gen-knob-dragging');
  };
  shell.addEventListener('pointerup', endDrag);
  shell.addEventListener('pointercancel', endDrag);
  shell.addEventListener('lostpointercapture', endDrag);
  dial.addEventListener('keydown', (event) => {
    if (input.disabled) return;
    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
    suppressHelp = true;
    hideTooltip();
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const step = input.step === 'any' ? (max - min) / 100 : Number(input.step || 1);
    const increment = Number.isFinite(step) && step > 0 ? step : 1;
    const before = input.value;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') setValue(input, Number(input.value) + increment);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') setValue(input, Number(input.value) - increment);
    else if (event.key === 'PageUp') setValue(input, Number(input.value) + increment * 10);
    else if (event.key === 'PageDown') setValue(input, Number(input.value) - increment * 10);
    else if (event.key === 'Home') setValue(input, min);
    else if (event.key === 'End') setValue(input, max);
    else return;
    event.preventDefault();
    if (before !== input.value) input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  input.addEventListener('input', () => syncKnob(input));
  input.addEventListener('change', () => syncKnob(input));
  syncKnob(input);
}

/** Enhance every continuous generator control once. Safe to call again after dynamic UI updates. */
export function mountGeneratorKnobs(container: HTMLElement): void {
  container.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(enhance);
  syncGeneratorKnobs(container);
}

/** Refresh dial position/disabled state after programmatic input.value updates. */
export function syncGeneratorKnobs(container: HTMLElement): void {
  container.querySelectorAll<HTMLInputElement>('input.gen-knob-source').forEach(syncKnob);
}
