import {songBlocks, sectionKind, type Bank} from '../core/bank.js';

export interface VerticalSongMapCallbacks {
  onSelectStep: (step: number, slot: number) => void;
  onRenameSection: (stepIndices: number[], newName: string) => void;
  onAddClipToSection: (beforeStep: number, slot: number, sectionName?: string) => void;
  onRemoveSection: (stepIndices: number[]) => void;
  onDuplicateStep: (step: number) => void;
  onChangeRepeats: (step: number, repeats: number) => void;
  onMoveStep: (step: number, delta: -1 | 1) => void;
  onRemoveStep: (step: number) => void;
  onReorderStep: (from: number, to: number) => void;
  onAddFirstPattern: () => void;
}

export interface SongMapSectionGroup {
  name: string;
  kind: string;
  startBar: number;
  endBar: number;
  totalBars: number;
  stepIndices: number[];
  blocks: ReturnType<typeof songBlocks>;
}

export function groupSongBlocksIntoSections(blocks: ReturnType<typeof songBlocks>): SongMapSectionGroup[] {
  if (!blocks.length) return [];
  const sections: SongMapSectionGroup[] = [];
  let current: SongMapSectionGroup | null = null;

  for (const block of blocks) {
    const rawName = block.section?.trim() || '';
    if (!current || current.name !== rawName) {
      current = {
        name: rawName,
        kind: sectionKind(rawName),
        startBar: block.startBar,
        endBar: block.endBar,
        totalBars: block.bars,
        stepIndices: [block.step],
        blocks: [block],
      };
      sections.push(current);
    } else {
      current.endBar = block.endBar;
      current.totalBars += block.bars;
      current.stepIndices.push(block.step);
      current.blocks.push(block);
    }
  }
  return sections;
}

let draggedClipStep: number | undefined = undefined;

export function renderVerticalSongMap(
  container: HTMLElement,
  bank: Bank,
  selectedStep: number | undefined,
  callbacks: VerticalSongMapCallbacks
): void {
  container.replaceChildren();

  if (!bank || !bank.sequence.length) {
    const empty = document.createElement('div');
    empty.className = 'song-map-empty-state';
    empty.innerHTML = `
      <div class="empty-icon">🗺</div>
      <h4>Song Map is Empty</h4>
      <p>Add patterns from your bank to map out the structure of your song.</p>
    `;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'song-map-empty-add-btn';
    addBtn.textContent = '+ Add First Pattern';
    addBtn.onclick = () => callbacks.onAddFirstPattern();
    empty.append(addBtn);
    container.append(empty);
    return;
  }

  const blocks = songBlocks(bank);
  const sections = groupSongBlocksIntoSections(blocks);

  sections.forEach(sec => {
    const sectionCard = document.createElement('div');
    sectionCard.className = 'song-map-section-card';
    sectionCard.dataset.sectionKind = sec.kind;
    sectionCard.style.setProperty('--section-color', sectionKindColor(sec.kind));

    // 1. Section Header
    const header = document.createElement('div');
    header.className = 'song-map-section-header';

    const pill = document.createElement('span');
    pill.className = 'song-map-section-pill';
    pill.textContent = (sec.kind || 'Section').toUpperCase();
    header.append(pill);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'song-map-section-title-input';
    nameInput.value = sec.name;
    nameInput.placeholder = 'Section name (e.g. Drop_01)';
    nameInput.maxLength = 32;
    nameInput.setAttribute('aria-label', `Section name for step ${sec.stepIndices[0]! + 1}`);
    nameInput.onchange = () => {
      callbacks.onRenameSection(sec.stepIndices, nameInput.value.trim());
    };
    header.append(nameInput);

    const barBadge = document.createElement('span');
    barBadge.className = 'song-map-section-bars';
    barBadge.textContent = `Bars ${sec.startBar}–${sec.endBar} (${sec.totalBars}b)`;
    header.append(barBadge);

    const headerActions = document.createElement('div');
    headerActions.className = 'song-map-section-actions';

    const addClipBtn = document.createElement('button');
    addClipBtn.type = 'button';
    addClipBtn.className = 'section-header-btn';
    addClipBtn.textContent = '+ Clip';
    addClipBtn.title = `Add clip to ${sec.name || 'section'}`;
    addClipBtn.setAttribute('aria-label', `Add clip to ${sec.name || 'section'}`);
    addClipBtn.onclick = () => {
      const lastBlock = sec.blocks.at(-1)!;
      callbacks.onAddClipToSection(lastBlock.step + 1, lastBlock.slot, sec.name || undefined);
    };
    headerActions.append(addClipBtn);

    const removeSecBtn = document.createElement('button');
    removeSecBtn.type = 'button';
    removeSecBtn.className = 'section-header-btn section-btn-del';
    removeSecBtn.textContent = '✕';
    removeSecBtn.title = `Remove ${sec.name || 'section'}`;
    removeSecBtn.setAttribute('aria-label', `Remove ${sec.name || 'section'}`);
    removeSecBtn.onclick = () => {
      callbacks.onRemoveSection(sec.stepIndices);
    };
    headerActions.append(removeSecBtn);

    header.append(headerActions);
    sectionCard.append(header);

    // 2. Section Body: List of clips with vertical ruler tracks
    const body = document.createElement('div');
    body.className = 'song-map-section-body';

    sec.blocks.forEach(block => {
      const clipRow = document.createElement('div');
      clipRow.className = 'song-map-clip-row';

      // Left: Bar ruler segment
      const ruler = document.createElement('div');
      ruler.className = 'song-map-ruler-track';
      ruler.setAttribute('aria-hidden', 'true');
      for (let b = block.startBar; b <= block.endBar; b++) {
        const barPill = document.createElement('div');
        barPill.className = 'song-map-ruler-bar';
        barPill.dataset.rulerBar = String(b);
        barPill.innerHTML = `<span class="ruler-bar-num">${b}</span>`;
        ruler.append(barPill);
      }
      clipRow.append(ruler);

      // Right: Clip card (.sequence-step)
      const clip = document.createElement('div');
      clip.className = 'song-map-clip sequence-step' + (selectedStep === block.step ? ' selected-step' : '');
      clip.dataset.step = String(block.step);
      clip.dataset.slot = String(block.slot);
      clip.dataset.sectionKind = sec.kind;
      clip.draggable = true;
      clip.tabIndex = 0;

      const slot = bank.slots[block.slot];
      const slotName = slot ? slot.name : `Slot ${block.slot}`;
      clip.setAttribute(
        'aria-label',
        `Step ${block.step + 1}: ${sec.name ? sec.name + ' · ' : ''}${slotName}, bars ${block.startBar} to ${block.endBar}`
      );

      // Top row: Span container matching `page.locator('[data-step="0"] > span')`
      const topRow = document.createElement('span');
      topRow.className = 'clip-top-row clip-title-span';

      const dragHandle = document.createElement('span');
      dragHandle.className = 'clip-drag-handle';
      dragHandle.textContent = '⠿';
      dragHandle.title = 'Drag this heading to reorder the song';
      topRow.append(dragHandle);

      const title = document.createElement('span');
      title.className = 'clip-title-text';
      title.textContent = `${block.step + 1}. ${slotName}`;
      title.title = 'Drag to reorder or click to select';
      topRow.append(title);

      const repeatsWrap = document.createElement('span');
      repeatsWrap.className = 'clip-repeats-ctrl';
      repeatsWrap.title = 'Clip repeat count';

      const decBtn = document.createElement('span');
      decBtn.role = 'button';
      decBtn.tabIndex = 0;
      decBtn.className = 'repeat-btn repeat-dec' + (block.repeats <= 1 ? ' is-disabled' : '');
      decBtn.textContent = '−';
      decBtn.title = 'Decrease repeats';
      decBtn.setAttribute('aria-label', `Decrease repeats for step ${block.step + 1}`);
      decBtn.onclick = (e) => {
        e.stopPropagation();
        if (block.repeats > 1) callbacks.onChangeRepeats(block.step, block.repeats - 1);
      };
      decBtn.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (block.repeats > 1) callbacks.onChangeRepeats(block.step, block.repeats - 1);
        }
      };

      const repeatVal = document.createElement('span');
      repeatVal.className = 'repeat-badge';
      repeatVal.textContent = `${block.repeats}×`;

      const incBtn = document.createElement('span');
      incBtn.role = 'button';
      incBtn.tabIndex = 0;
      incBtn.className = 'repeat-btn repeat-inc' + (block.repeats >= 16 ? ' is-disabled' : '');
      incBtn.textContent = '+';
      incBtn.title = 'Increase repeats';
      incBtn.setAttribute('aria-label', `Increase repeats for step ${block.step + 1}`);
      incBtn.onclick = (e) => {
        e.stopPropagation();
        if (block.repeats < 16) callbacks.onChangeRepeats(block.step, block.repeats + 1);
      };
      incBtn.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (block.repeats < 16) callbacks.onChangeRepeats(block.step, block.repeats + 1);
        }
      };

      repeatsWrap.append(decBtn, repeatVal, incBtn);
      topRow.append(repeatsWrap);
      clip.append(topRow);

      // Bottom row: Range info & Duration
      const bottomRow = document.createElement('div');
      bottomRow.className = 'clip-bottom-row';

      const range = document.createElement('small');
      range.className = 'sequence-range clip-meta-range';
      range.textContent = `Bars ${block.startBar}–${block.endBar} · ${block.bars}b`;
      bottomRow.append(range);

      const dur = document.createElement('small');
      dur.className = 'clip-meta-duration';
      dur.textContent = `${block.duration.toFixed(1)}s`;
      bottomRow.append(dur);
      clip.append(bottomRow);

      // Actions row: Move up, Move down, Dup, Remove
      // (Order is vital for smoke test selectors: .first() is Move up, .last() is Remove)
      const actions = document.createElement('div');
      actions.className = 'clip-action-bar';

      const moveUpBtn = document.createElement('button');
      moveUpBtn.type = 'button';
      moveUpBtn.className = 'clip-action-btn clip-btn-up';
      moveUpBtn.textContent = 'Move up';
      moveUpBtn.title = 'Move step up';
      moveUpBtn.disabled = block.step === 0;
      moveUpBtn.setAttribute('aria-label', `Move step ${block.step + 1} up`);
      moveUpBtn.onclick = (e) => {
        e.stopPropagation();
        callbacks.onMoveStep(block.step, -1);
      };
      actions.append(moveUpBtn);

      const moveDownBtn = document.createElement('button');
      moveDownBtn.type = 'button';
      moveDownBtn.className = 'clip-action-btn clip-btn-down';
      moveDownBtn.textContent = 'Move down';
      moveDownBtn.title = 'Move step down';
      moveDownBtn.disabled = block.step >= bank.sequence.length - 1;
      moveDownBtn.setAttribute('aria-label', `Move step ${block.step + 1} down`);
      moveDownBtn.onclick = (e) => {
        e.stopPropagation();
        callbacks.onMoveStep(block.step, 1);
      };
      actions.append(moveDownBtn);

      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'clip-action-btn clip-btn-dup';
      dupBtn.textContent = '⎘ Dup';
      dupBtn.title = 'Duplicate this clip';
      dupBtn.setAttribute('aria-label', `Duplicate step ${block.step + 1}`);
      dupBtn.onclick = (e) => {
        e.stopPropagation();
        callbacks.onDuplicateStep(block.step);
      };
      actions.append(dupBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'clip-action-btn clip-btn-del';
      removeBtn.textContent = 'Remove';
      removeBtn.title = 'Remove this clip';
      removeBtn.setAttribute('aria-label', `Remove step ${block.step + 1}`);
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        callbacks.onRemoveStep(block.step);
      };
      actions.append(removeBtn);

      clip.append(actions);

      // Clip click: Activate pattern in center tracker
      clip.onclick = (e) => {
        if ((e.target as HTMLElement).closest('button, input')) return;
        callbacks.onSelectStep(block.step, block.slot);
      };

      // Drag and Drop reordering
      clip.ondragstart = (e) => {
        if ((e.target as HTMLElement).closest('button, input')) {
          e.preventDefault();
          return;
        }
        draggedClipStep = block.step;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', String(block.step));
          e.dataTransfer.effectAllowed = 'move';
        }
        clip.classList.add('is-dragging');
      };

      clip.ondragover = (e) => {
        if (draggedClipStep !== undefined && draggedClipStep !== block.step) {
          e.preventDefault();
          clip.classList.add('drop-target');
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        }
      };

      clip.ondragleave = () => {
        clip.classList.remove('drop-target');
      };

      clip.ondragend = () => {
        draggedClipStep = undefined;
        container.querySelectorAll('.drop-target, .is-dragging').forEach(el => {
          el.classList.remove('drop-target', 'is-dragging');
        });
      };

      clip.ondrop = (e) => {
        e.preventDefault();
        clip.classList.remove('drop-target');
        if (draggedClipStep === undefined || draggedClipStep === block.step) return;
        const from = draggedClipStep;
        draggedClipStep = undefined;
        callbacks.onReorderStep(from, block.step);
      };

      clipRow.append(clip);
      body.append(clipRow);
    });

    sectionCard.append(body);
    container.append(sectionCard);
  });
}

export function updateVerticalSongMapPlayback(
  container: HTMLElement,
  currentStep: number | undefined,
  currentBar: number | undefined
): void {
  // 1. Highlight playing clip
  const currentPlayingClips = container.querySelectorAll('.song-map-clip.playing-step');
  currentPlayingClips.forEach(el => el.classList.remove('playing-step'));

  if (currentStep !== undefined) {
    const activeClip = container.querySelector<HTMLElement>(`.song-map-clip[data-step="${currentStep}"]`);
    if (activeClip) {
      activeClip.classList.add('playing-step');
    }
  }

  // 2. Highlight playing bar on ruler
  const currentPlayingBars = container.querySelectorAll('.song-map-ruler-bar.is-playing');
  currentPlayingBars.forEach(el => {
    el.classList.remove('is-playing');
    const marker = el.querySelector('.play-marker');
    if (marker) marker.remove();
  });

  if (currentBar !== undefined) {
    const activeBar = container.querySelector<HTMLElement>(`.song-map-ruler-bar[data-ruler-bar="${currentBar}"]`);
    if (activeBar) {
      activeBar.classList.add('is-playing');
      const numSpan = activeBar.querySelector('.ruler-bar-num');
      if (numSpan && !activeBar.querySelector('.play-marker')) {
        const marker = document.createElement('span');
        marker.className = 'play-marker';
        marker.textContent = '▶';
        activeBar.prepend(marker);
      }
    }
  }
}

export function sectionKindColor(kind: string): string {
  switch (kind) {
    case 'drop': return '#00f5d4';
    case 'break': return '#ff9f43';
    case 'build': return '#feca57';
    case 'intro': return '#48dbfb';
    case 'fill': return '#ff6b6b';
    case 'outro': return '#1dd1a1';
    default: return '#a29bfe';
  }
}
