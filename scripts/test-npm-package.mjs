// Exercise the tarball outside the checkout, without a local ntwebterm install.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const consumer = mkdtempSync(join(tmpdir(), 'booba-package-'));
const run = (cmd, args, cwd = consumer) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
try {
    // prepack builds from the pinned submodule, even if dist was stale or absent.
    run('npm', ['pack', '--loglevel=error', '--pack-destination', consumer], root);
    const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', `./nimbleterminal-booba-${version}.tgz`]);
    const installed = JSON.parse(readFileSync(join(consumer, 'node_modules/@nimbleterminal/booba/package.json'), 'utf8'));
    assert.equal(installed.dependencies?.ntwebterm, undefined);
    writeFileSync(join(consumer, 'check.ts'), `
import { BoobaTerminal, installRendererHud, type RendererBackend, type BoobaTerminalOptions } from '@nimbleterminal/booba';
const renderer: RendererBackend = 'canvas2d';
const options: BoobaTerminalOptions = { renderer, scrollback: 1000 };
const terminal = new BoobaTerminal('terminal', options);
const ready: Promise<void> = terminal.init();
void ready; void installRendererHud;
`);
    // Both Node ESM and bundler consumers must resolve declarations, with no skipLibCheck.
    for (const resolution of ['NodeNext', 'Bundler']) {
        run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict',
            '--target', 'ES2022', '--lib', 'ES2022,DOM', '--module', resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
            '--moduleResolution', resolution, 'check.ts']);
    }
    writeFileSync(join(consumer, 'check.mjs'), `
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BoobaTerminal, installRendererHud } from '@nimbleterminal/booba';
assert.equal(typeof BoobaTerminal, 'function');
assert.equal(typeof installRendererHud, 'function');
const entry = import.meta.resolve('@nimbleterminal/booba');
const engine = await import(new URL('./ntwebterm/ntwebterm.js', entry));
// The browser bundle resolves its default URL against self.location.
// Supply that browser global while exercising the real WASM loader in Node.
globalThis.self = { location: "https://consumer.invalid/app/" };
// Reject accidental CDN/network fallback; the default must use the packed payload.
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (url, options) => {
    assert.ok(String(url).startsWith("data:application/wasm;"), "unexpected WASM network request");
    return fetchOriginal(url, options);
};
await engine.init();
const bytes = await readFile(new URL(import.meta.resolve('@nimbleterminal/booba/ghostty-vt.wasm')));
const explicit = await engine.Ghostty.load('data:application/wasm;base64,' + bytes.toString('base64'));
for (const ghostty of [engine.getGhostty(), explicit]) {
    const term = ghostty.createTerminal(80, 24);
    try {
        term.write('packed booba\\x1b[6n');
        assert.equal(term.readResponse(), '\\x1b[1;13R');
    } finally { term.free(); }
}
console.log('Packed consumer: imports, strict types, default and exported WASM passed.');
`);
    run(process.execPath, ['check.mjs']);
} finally {
    rmSync(consumer, { recursive: true, force: true });
}
