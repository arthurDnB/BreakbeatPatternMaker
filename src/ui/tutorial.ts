// First-Run Guided Spotlight Tutorial
// Provides a beginner-friendly 5-step interactive tour of key workstation controls.

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
}

export interface TutorialOptions {
  storageKey?: string;
  onOpenGeneratorTray?: () => void;
  onRestoreGeneratorTray?: (openedByTutorial: boolean) => void;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'generator-settings',
    title: 'Generator Settings',
    description: 'Choose your genre, tempo (BPM), and pattern length here to shape the groove and sound profile.',
    targetSelector: '#controls'
  },
  {
    id: 'layer-generators',
    title: 'Choose a Layer to Generate',
    description: 'Trigger beat, bassline, melody, or piano layers independently without overwriting the rest of your track.',
    targetSelector: '#transport-triggers'
  },
  {
    id: 'playback',
    title: 'Playback Controls',
    description: 'Press Play to hear your pattern loop in real time, or switch between Pattern and Song arrangement playback.',
    targetSelector: '#play'
  },
  {
    id: 'tracker-editing',
    title: 'Tracker Pattern Editor',
    description: 'Click any cell to edit notes, velocity, or effects like rolls and pitch slides. Lock hits you like to protect them.',
    targetSelector: '#grid'
  },
  {
    id: 'export',
    title: 'Export Audio',
    description: 'Render your active pattern or full song arrangement to studio-grade WAV or MP3 audio whenever you are ready.',
    targetSelector: '.output-group'
  }
];

export class TutorialController {
  private overlay: HTMLElement;
  private spotlight: HTMLElement;
  private toolbox: HTMLElement;
  private stepCountEl: HTMLElement;
  private titleEl: HTMLElement;
  private descEl: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;
  private dotsContainer: HTMLElement;
  private tutorialTriggerBtn: HTMLButtonElement | null = null;

  private currentStepIndex = 0;
  private active = false;
  private openedTrayForTutorial = false;
  private returnFocusElement: HTMLElement | null = null;
  private boundReposition: () => void;
  private boundKeydown: (e: KeyboardEvent) => void;

  private storageKey: string;
  private onOpenGeneratorTray?: () => void;
  private onRestoreGeneratorTray?: (openedByTutorial: boolean) => void;

  constructor(options: TutorialOptions = {}) {
    this.storageKey = options.storageKey ?? 'bpm_tutorial_dismissed';
    this.onOpenGeneratorTray = options.onOpenGeneratorTray;
    this.onRestoreGeneratorTray = options.onRestoreGeneratorTray;

    this.overlay = document.getElementById('tutorial-overlay')!;
    this.spotlight = document.getElementById('tutorial-spotlight')!;
    this.toolbox = document.getElementById('tutorial-toolbox')!;
    this.stepCountEl = document.getElementById('tutorial-step-count')!;
    this.titleEl = document.getElementById('tutorial-step-title')!;
    this.descEl = document.getElementById('tutorial-step-desc')!;
    this.prevBtn = document.getElementById('tutorial-prev') as HTMLButtonElement;
    this.nextBtn = document.getElementById('tutorial-next') as HTMLButtonElement;
    this.skipBtn = document.getElementById('tutorial-skip') as HTMLButtonElement;
    this.dotsContainer = document.getElementById('tutorial-dots')!;
    this.tutorialTriggerBtn = document.getElementById('tutorial-btn') as HTMLButtonElement | null;

    this.boundReposition = () => this.reposition();
    this.boundKeydown = (e: KeyboardEvent) => this.handleKeydown(e);

    this.initEvents();
  }

  private initEvents(): void {
    this.nextBtn.addEventListener('click', () => this.next());
    this.prevBtn.addEventListener('click', () => this.prev());
    this.skipBtn.addEventListener('click', () => this.end(true));

    if (this.tutorialTriggerBtn) {
      this.tutorialTriggerBtn.addEventListener('click', () => this.start(false));
    }

    // Build dots
    this.dotsContainer.innerHTML = '';
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'tutorial-dot';
      dot.setAttribute('data-step', String(i));
      this.dotsContainer.appendChild(dot);
    }
  }

  public isDismissed(): boolean {
    try {
      return localStorage.getItem(this.storageKey) === '1';
    } catch {
      return false;
    }
  }

  public setDismissed(): void {
    try {
      localStorage.setItem(this.storageKey, '1');
    } catch {}
  }

  public isActive(): boolean {
    return this.active;
  }

  public getCurrentStep(): number {
    return this.currentStepIndex;
  }

  public start(isAuto = false): void {
    if (this.active) return;
    this.active = true;
    this.currentStepIndex = 0;
    this.returnFocusElement = (document.activeElement as HTMLElement) || null;

    if (this.tutorialTriggerBtn) {
      this.tutorialTriggerBtn.setAttribute('aria-expanded', 'true');
    }

    // Check if bottom tray needs to be opened for generator-settings step
    const bottomTray = document.getElementById('tray-bottom');
    const wasCollapsed = bottomTray ? bottomTray.classList.contains('tray-bottom-collapsed') : true;
    if (wasCollapsed && this.onOpenGeneratorTray) {
      this.openedTrayForTutorial = true;
      this.onOpenGeneratorTray();
    } else {
      this.openedTrayForTutorial = false;
    }

    this.overlay.hidden = false;
    this.overlay.removeAttribute('hidden');

    window.addEventListener('resize', this.boundReposition, { passive: true });
    window.addEventListener('scroll', this.boundReposition, { capture: true, passive: true });
    document.addEventListener('keydown', this.boundKeydown);

    this.showStep(0);
  }

  public showStep(index: number): void {
    if (index < 0 || index >= TUTORIAL_STEPS.length) return;
    this.currentStepIndex = index;
    const step = TUTORIAL_STEPS[index];
    if (!step) return;

    // If returning to step 0 and bottom tray is collapsed, ensure it opens
    if (index === 0) {
      const bottomTray = document.getElementById('tray-bottom');
      if (bottomTray?.classList.contains('tray-bottom-collapsed') && this.onOpenGeneratorTray) {
        this.openedTrayForTutorial = true;
        this.onOpenGeneratorTray();
      }
    }

    this.stepCountEl.textContent = `Step ${index + 1} of ${TUTORIAL_STEPS.length}`;
    this.titleEl.textContent = step.title;
    this.descEl.textContent = step.description;

    this.prevBtn.disabled = index === 0;
    this.nextBtn.textContent = index === TUTORIAL_STEPS.length - 1 ? 'Done' : 'Next';

    // Update dots
    const dots = this.dotsContainer.querySelectorAll('.tutorial-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
    });

    const target = document.querySelector<HTMLElement>(step.targetSelector);
    if (target) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try {
        target.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      } catch {}
    }

    requestAnimationFrame(() => {
      this.reposition();
      this.nextBtn.focus();
    });
  }

  public next(): void {
    if (this.currentStepIndex < TUTORIAL_STEPS.length - 1) {
      this.showStep(this.currentStepIndex + 1);
    } else {
      this.end(false);
    }
  }

  public prev(): void {
    if (this.currentStepIndex > 0) {
      this.showStep(this.currentStepIndex - 1);
    }
  }

  public end(skipped = false): void {
    if (!this.active) return;
    this.active = false;
    this.overlay.hidden = true;
    this.overlay.setAttribute('hidden', '');

    if (this.tutorialTriggerBtn) {
      this.tutorialTriggerBtn.setAttribute('aria-expanded', 'false');
    }

    this.setDismissed();

    window.removeEventListener('resize', this.boundReposition);
    window.removeEventListener('scroll', this.boundReposition, true);
    document.removeEventListener('keydown', this.boundKeydown);

    // Restore workspace tray if it was opened by the tutorial
    if (this.onRestoreGeneratorTray) {
      this.onRestoreGeneratorTray(this.openedTrayForTutorial);
    }
    this.openedTrayForTutorial = false;

    // Restore keyboard focus
    if (this.returnFocusElement && this.returnFocusElement.isConnected) {
      this.returnFocusElement.focus();
    } else if (this.tutorialTriggerBtn) {
      this.tutorialTriggerBtn.focus();
    }
  }

  public reposition(): void {
    if (!this.active || this.overlay.hidden) return;
    const step = TUTORIAL_STEPS[this.currentStepIndex];
    if (!step) return;

    const target = document.querySelector<HTMLElement>(step.targetSelector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const pad = 6;
    const top = Math.max(0, rect.top - pad);
    const left = Math.max(0, rect.left - pad);
    const width = Math.min(window.innerWidth - left, rect.width + pad * 2);
    const height = Math.min(window.innerHeight - top, rect.height + pad * 2);

    this.spotlight.style.top = `${top}px`;
    this.spotlight.style.left = `${left}px`;
    this.spotlight.style.width = `${Math.max(16, width)}px`;
    this.spotlight.style.height = `${Math.max(16, height)}px`;

    const isSmall = window.innerWidth <= 640;
    const toolboxWidth = Math.min(340, window.innerWidth - 24);
    const toolboxHeight = this.toolbox.offsetHeight || 190;

    if (isSmall) {
      // Small screen: dock at top or bottom depending on spotlight position
      if (rect.top > window.innerHeight / 2) {
        this.toolbox.style.top = '12px';
        this.toolbox.style.bottom = 'auto';
      } else {
        this.toolbox.style.top = 'auto';
        this.toolbox.style.bottom = '12px';
      }
      this.toolbox.style.left = '12px';
      this.toolbox.style.right = '12px';
      this.toolbox.style.width = 'calc(100vw - 24px)';
      this.toolbox.style.margin = '0 auto';
    } else {
      this.toolbox.style.width = `${toolboxWidth}px`;
      this.toolbox.style.bottom = 'auto';
      this.toolbox.style.right = 'auto';
      this.toolbox.style.margin = '0';

      const spaceBelow = window.innerHeight - (rect.bottom + pad);
      const spaceAbove = rect.top - pad;

      let toolTop: number;
      if (spaceBelow >= toolboxHeight + 16) {
        toolTop = rect.bottom + pad + 10;
      } else if (spaceAbove >= toolboxHeight + 16) {
        toolTop = rect.top - pad - toolboxHeight - 10;
      } else {
        toolTop = spaceBelow >= spaceAbove
          ? Math.min(window.innerHeight - toolboxHeight - 12, rect.bottom + pad + 6)
          : Math.max(12, rect.top - pad - toolboxHeight - 6);
      }

      let toolLeft = rect.left + (rect.width - toolboxWidth) / 2;
      toolLeft = Math.max(12, Math.min(window.innerWidth - toolboxWidth - 12, toolLeft));

      this.toolbox.style.top = `${toolTop}px`;
      this.toolbox.style.left = `${toolLeft}px`;
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (!this.active) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.end(true);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.next();
      return;
    }

    if (e.key === 'ArrowLeft' && this.currentStepIndex > 0) {
      e.preventDefault();
      this.prev();
      return;
    }

    // Focus trap within toolbox
    if (e.key === 'Tab') {
      const focusable = Array.from(
        this.toolbox.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (first && last) {
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
  }
}
