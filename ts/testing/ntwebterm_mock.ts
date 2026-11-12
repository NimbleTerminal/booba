/**
 * Shared stand-in for the `ntwebterm` module in BoobaTerminal tests.
 *
 *     vi.mock('ntwebterm', () => import('./testing/ntwebterm_mock.js'));
 *
 * Every runtime export booba's sources import or re-export from ntwebterm must
 * appear here; add new ones in this file only. The Terminal is the minimum
 * init() needs: no canvas, no renderer, no mouse tracking. A suite that needs
 * more extends it in its own factory:
 *
 *     vi.mock('ntwebterm', async () => {
 *         const mock = await import('./testing/ntwebterm_mock.js');
 *         return { ...mock, Terminal: class extends mock.Terminal { ... } };
 *     });
 *
 * Excluded from the build; `npm test` type-checks it via tsconfig.test.json.
 */
import { vi } from 'vitest';
import type { Terminal as RealTerminal } from 'ntwebterm';

/** Every event the real Terminal exposes, so an upstream addition or rename fails the type check. */
type TerminalEvents = Record<Extract<keyof RealTerminal, `on${string}`>, unknown>;

const handler = () => vi.fn((_listener: (...args: never[]) => void) => ({ dispose: vi.fn() }));

export const init = vi.fn(async () => {});

export class Terminal implements TerminalEvents {
    cols = 80;
    rows = 24;
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown> = {}) { this.options = options; }
    open = vi.fn(async (_host: HTMLElement) => {});
    loadAddon = vi.fn(); dispose = vi.fn();
    write = vi.fn(); input = vi.fn(); sendKey = vi.fn(); reset = vi.fn();
    onWriteParsed = handler();
    onResize = handler(); onData = handler(); onBell = handler(); onSelectionChange = handler();
    onKey = handler(); onTitleChange = handler(); onScroll = handler(); onRender = handler(); onCursorMove = handler();
    onProgramStatus = handler();
    onClipboardWrite = handler(); onPwdChange = handler(); onNotification = handler(); onProgress = handler();
    onSemanticPrompt = handler(); onResizeRequest = handler();
}

export class FitAddon { fit = vi.fn(); observeResize = vi.fn(); }
export class SearchAddon {}
export class AutomationAddon {}

export const Key = { A: 20, ENTER: 49, ARROW_UP: 58 } as const;
export const KeyAction = { RELEASE: 0, PRESS: 1, REPEAT: 2 } as const;
export const Mods = { NONE: 0, SHIFT: 1, CTRL: 2, ALT: 4, SUPER: 8, CAPSLOCK: 16, NUMLOCK: 32 } as const;

export const installRendererHud = vi.fn();
export const parseRendererFromURL = vi.fn();
export const forwardNotificationsToBrowser = vi.fn();
export const writeTextToClipboard = vi.fn();
