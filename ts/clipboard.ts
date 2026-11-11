/**
 * OSC 52 clipboard handler.
 *
 * Scans terminal output for OSC 52 sequences and copies decoded
 * content to the system clipboard. Output arrives as bytes from a
 * WebSocket and as strings from the wasm bridge; both are scanned.
 *
 * BoobaTerminal does not use this: ntwebterm handles OSC 52 natively under
 * its `clipboardWrite` option. It remains for hosts scanning a raw stream.
 * Copies go through ntwebterm's `writeTextToClipboard`, so both paths share
 * the same browser fallbacks. OSC 5522 is not recognized here.
 *
 * OSC 52 format: \x1b]52;c;<base64-data>\a (or \x1b\\ as terminator)
 * The base64 payload is UTF-8 text.
 */

import { writeTextToClipboard } from 'ntwebterm';

const OSC_START = '\x1b]52;';
const ST_BEL = '\x07';
const ST_ESC = '\x1b\\';

/**
 * @deprecated BoobaTerminal no longer scans output itself: ntwebterm handles
 * OSC 52 / OSC 5522 natively under the `clipboardWrite` option. Kept for hosts
 * that scan a stream without a terminal.
 */
export class OSC52Scanner {
    private buffer = '';

    constructor(private allowOSC52: boolean = false) {}

    /** Process a chunk of output data, extracting OSC 52 clipboard sequences. */
    scan(data: Uint8Array | string): void {
        if (!this.allowOSC52) return;
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        this.buffer += text;

        let startIdx: number;
        while ((startIdx = this.buffer.indexOf(OSC_START)) !== -1) {
            const afterStart = startIdx + OSC_START.length;
            let endIdx = this.buffer.indexOf(ST_BEL, afterStart);
            let endLen = 1;
            if (endIdx === -1) {
                endIdx = this.buffer.indexOf(ST_ESC, afterStart);
                endLen = 2;
            }
            if (endIdx === -1) {
                // Incomplete sequence — keep buffering from start
                this.buffer = this.buffer.substring(startIdx);
                return;
            }

            const payload = this.buffer.substring(afterStart, endIdx);
            const semiIdx = payload.indexOf(';');
            if (semiIdx !== -1) {
                const base64Data = payload.substring(semiIdx + 1);
                if (base64Data.length > 0) {
                    try {
                        writeTextToClipboard(decodeUTF8Base64(base64Data));
                    } catch {
                        // Invalid base64
                    }
                }
            }

            this.buffer = this.buffer.substring(endIdx + endLen);
        }

        // No OSC start found — clear buffer
        if (this.buffer.indexOf('\x1b]') === -1) {
            this.buffer = '';
        }
    }
}

/** Decode base64 whose bytes are UTF-8 text. atob alone yields one char per byte. */
function decodeUTF8Base64(base64Data: string): string {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}
