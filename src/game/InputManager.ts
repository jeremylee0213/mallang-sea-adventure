const CONTROL_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'KeyE', 'KeyF', 'KeyQ', 'KeyR', 'KeyM', 'Escape',
  'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
]);

export interface PointerLookDelta {
  readonly x: number;
  readonly y: number;
}

export class InputManager {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private enabled = true;
  private lookPointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lookDeltaX = 0;
  private lookDeltaY = 0;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('blur', this.reset);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  isDown(...codes: string[]): boolean {
    return this.enabled && codes.some((code) => this.held.has(code));
  }

  consume(...codes: string[]): boolean {
    if (!this.enabled) return false;
    const matched = codes.find((code) => this.pressed.has(code));
    if (!matched) return false;
    codes.forEach((code) => this.pressed.delete(code));
    return true;
  }

  consumeLookDelta(): PointerLookDelta {
    if (!this.enabled) return { x: 0, y: 0 };
    const delta = { x: this.lookDeltaX, y: this.lookDeltaY };
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return delta;
  }

  endFrame(): void {
    this.pressed.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('blur', this.reset);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!CONTROL_CODES.has(event.code)) return;
    const target = event.target as HTMLElement | null;
    const typing = target?.matches('input, select, textarea, button');
    if (!typing) event.preventDefault();
    if (!this.enabled || typing) return;
    if (!event.repeat) this.pressed.add(event.code);
    this.held.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (!CONTROL_CODES.has(event.code)) return;
    this.held.delete(event.code);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!this.enabled || event.button !== 0 || target?.closest('button, input, select, .screen-overlay')) return;
    this.pressed.add('Mouse0');
    this.lookPointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.enabled || event.pointerId !== this.lookPointerId) return;
    this.lookDeltaX += event.clientX - this.lastPointerX;
    this.lookDeltaY += event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.lookPointerId) return;
    this.lookPointerId = null;
  };

  private readonly reset = (): void => {
    this.held.clear();
    this.pressed.clear();
    this.lookPointerId = null;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
  };
}
