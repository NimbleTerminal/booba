import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { BoobaAdapter, BoobaConnectionState } from './adapter.js';
vi.mock('ntwebterm', () => import('./testing/ntwebterm_mock.js'));
import { BoobaTerminal, type BoobaTerminalOptions } from './booba.js';

// ntwebterm handles OSC 52 natively under `clipboardWrite`; booba resolves the
// policy, hands it to the terminal, and never copies from the stream itself.
class Adapter implements BoobaAdapter {
    state!: (state: BoobaConnectionState, message: string) => void;
    output!: (data: string | Uint8Array) => void;
    boobaRead = () => null;
    boobaWrite = vi.fn();
    boobaResize = vi.fn();
    disconnect = vi.fn();
    connect(output: Adapter['output'], state: Adapter['state']) { this.output = output; this.state = state; state('connected', 'ready'); }
}

async function setup(options: BoobaTerminalOptions) {
    const host = document.createElement('div'); host.id = 'clipboard-host'; document.body.append(host);
    const booba = new BoobaTerminal(host.id, options);
    await booba.init();
    const adapter = new Adapter(); booba.connectAdapter(adapter);
    return { booba, adapter, cleanup: () => { booba.dispose(); host.remove(); } };
}

const copy = `\x1b]52;c;${btoa('hello')}\x07`;

describe('BoobaTerminal clipboard policy', () => {
    let writeText: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it.each<[BoobaTerminalOptions, string]>([
        [{}, 'deny'],
        [{ allowOSC52: false }, 'deny'],
        [{ allowOSC52: true }, 'browser'],
        [{ allowOSC52: false, clipboardWrite: 'event' }, 'event'],
        [{ allowOSC52: true, clipboardWrite: 'deny' }, 'deny'],
        [{ allowOSC52: false, clipboardWrite: 'browser' }, 'browser'],
        [{ allowOSC52: undefined, clipboardWrite: undefined }, 'deny'],
        [{ allowOSC52: true, clipboardWrite: undefined }, 'browser'],
    ])('resolves %j to clipboardWrite %s and hands it to ntwebterm', async (options, expected) => {
        const { booba, cleanup } = await setup(options);
        try {
            expect(booba.options.clipboardWrite).toBe(expected);
            expect(booba.options.allowOSC52).toBe(options.allowOSC52 ?? false);
            expect(booba.term!.options.clipboardWrite).toBe(expected);
        } finally { cleanup(); }
    });

    it.each([['string', copy], ['byte', new TextEncoder().encode(copy)]])(
        'passes %s output through to the terminal without copying it itself', async (_kind, data) => {
            const { booba, adapter, cleanup } = await setup({ allowOSC52: true });
            try {
                adapter.output(data);
                expect(booba.term!.write).toHaveBeenCalledWith(data, undefined);
                expect(writeText).not.toHaveBeenCalled();
            } finally { cleanup(); }
        });

    it('does not copy from output that arrives before init()', () => {
        const booba = new BoobaTerminal('unused', { clipboardWrite: 'browser' });
        const adapter = new Adapter(); booba.connectAdapter(adapter);
        adapter.output(copy);
        expect(writeText).not.toHaveBeenCalled();
    });

    it('forwards ntwebterm clipboard write events to onClipboardWrite', async () => {
        const { booba, cleanup } = await setup({ clipboardWrite: 'event' });
        try {
            const seen = vi.fn(); booba.onClipboardWrite = seen;
            const event = { text: 'hello' };
            const emit = vi.mocked(booba.term!.onClipboardWrite).mock.calls[0][0] as unknown as (e: unknown) => void;
            emit(event);
            expect(seen).toHaveBeenCalledWith(event);
        } finally { cleanup(); }
    });
});
