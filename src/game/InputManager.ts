const CONTROL_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'KeyE', 'KeyF', 'KeyR', 'KeyM', 'Escape',
  'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
]);

export class InputManager {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private enabled = true;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('pointerdown', this.onPointerDown);
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

  endFrame(): void {
    this.pressed.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerdown', this.onPointerDown);
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
  };

  private readonly reset = (): void => {
    this.held.clear();
    this.pressed.clear();
  };
}
