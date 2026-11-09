import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { BoobaAdapter, BoobaConnectionState } from './adapter.js';
vi.mock('ntwebterm', () => ({ init: vi.fn(), Terminal: class {}, FitAddon: class {}, SearchAddon: class {}, installRendererHud: vi.fn(), parseRendererFromURL: vi.fn(), forwardNotificationsToBrowser: vi.fn(), writeTextToClipboard: vi.fn() }));
import { BoobaTerminal } from './booba.js';

// Program output reaches the terminal as bytes from a WebSocket and as
// strings from the wasm bridge. An OSC 52 clipboard write must copy either way.
class Adapter implements BoobaAdapter {
    state!: (state: BoobaConnectionState, message: string) => void;
    output!: (data: string | Uint8Array) => void;
    boobaRead = () => null;
    boobaWrite = vi.fn();
    boobaResize = vi.fn();
    disconnect = vi.fn();
    connect(output: Adapter['output'], state: Adapter['state']) { this.output = output; this.state = state; state('connected', 'ready'); }
}

function setup(allowOSC52: boolean) {
    const booba = new BoobaTerminal('unused', { allowOSC52 });
    const terminal = { options: { disableStdin: false }, input: vi.fn(), write: vi.fn(), reset: vi.fn(), dispose: vi.fn(), cols: 80, rows: 24, onProgramStatus: vi.fn(() => ({ dispose: vi.fn() })) };
    booba.term = terminal as unknown as NonNullable<BoobaTerminal['term']>;
    const adapter = new Adapter(); booba.connectAdapter(adapter);
    return { booba, terminal, adapter };
}

const copy = `\x1b]52;c;${btoa('hello')}\x07`;

describe('BoobaTerminal OSC 52 on program output', () => {
    let writeText: ReturnType<typeof vi.fn>;
    beforeEach(() => { writeText = vi.fn().mockResolvedValue(undefined); vi.stubGlobal('navigator', { clipboard: { writeText } }); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('copies from string output, as the wasm bridge delivers it', () => {
        const { adapter } = setup(true);
        adapter.output(copy);
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('copies from byte output, as a WebSocket delivers it', () => {
        const { adapter } = setup(true);
        adapter.output(new TextEncoder().encode(copy));
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('does not copy when allowOSC52 is off', () => {
        const { booba, adapter } = setup(false);
        expect(booba.options.clipboardWrite).toBe('deny');
        adapter.output(copy);
        expect(writeText).not.toHaveBeenCalled();
    });

    it('delegates to native ntwebterm clipboardWrite when onClipboardWrite is present', () => {
        const booba = new BoobaTerminal('unused', { allowOSC52: true });
        expect(booba.options.clipboardWrite).toBe('browser');
        const terminal = {
            options: { disableStdin: false },
            input: vi.fn(),
            write: vi.fn(),
            reset: vi.fn(),
            dispose: vi.fn(),
            cols: 80,
            rows: 24,
            onClipboardWrite: vi.fn(() => ({ dispose: vi.fn() })),
            onProgramStatus: vi.fn(() => ({ dispose: vi.fn() })),
        };
        booba.term = terminal as unknown as NonNullable<BoobaTerminal['term']>;
        const adapter = new Adapter();
        booba.connectAdapter(adapter);
        adapter.output(copy);
        // OSC52Scanner is skipped when the terminal supports native onClipboardWrite;
        // the sequence is written to the terminal for libghostty-vt to handle.
        expect(writeText).not.toHaveBeenCalled();
        expect(terminal.write).toHaveBeenCalledWith(copy, undefined);
    });

    it('honors explicit clipboardWrite option over allowOSC52, including in fallback scanner', () => {
        const eventOnly = new BoobaTerminal('unused', { allowOSC52: false, clipboardWrite: 'event' });
        expect(eventOnly.options.clipboardWrite).toBe('event');

        const denied = new BoobaTerminal('unused', { allowOSC52: true, clipboardWrite: 'deny' });
        expect(denied.options.clipboardWrite).toBe('deny');
        const adapter = new Adapter();
        denied.connectAdapter(adapter);
        adapter.output(copy);
        expect(writeText).not.toHaveBeenCalled();

        const browserEnabled = new BoobaTerminal('unused', { allowOSC52: false, clipboardWrite: 'browser' });
        expect(browserEnabled.options.clipboardWrite).toBe('browser');
        const adapter2 = new Adapter();
        browserEnabled.connectAdapter(adapter2);
        adapter2.output(copy);
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('preserves default deny policy when clipboardWrite or allowOSC52 are explicitly undefined', () => {
        const booba = new BoobaTerminal('unused', { allowOSC52: undefined, clipboardWrite: undefined });
        expect(booba.options.allowOSC52).toBe(false);
        expect(booba.options.clipboardWrite).toBe('deny');

        const allowed = new BoobaTerminal('unused', { allowOSC52: true, clipboardWrite: undefined });
        expect(allowed.options.allowOSC52).toBe(true);
        expect(allowed.options.clipboardWrite).toBe('browser');
    });
});
