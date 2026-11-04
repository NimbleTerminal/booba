// Package the pinned, prebuilt engine; consumers never need our submodule.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = new URL('../dist/', import.meta.url);
const upstream = new URL('../third_party/ntwebterm/', import.meta.url);
rmSync(dist, { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--sourceMap', 'false', '--declarationMap', 'false'], { cwd: root, stdio: 'inherit' });

// Rewrite both runtime and declaration imports. Keep the embedded Go build separate.
for (const name of readdirSync(dist)) {
    if (!name.endsWith('.js') && !name.endsWith('.d.ts')) continue;
    const path = new URL(name, dist);
    const text = readFileSync(path, 'utf8').replace(/(['"])ntwebterm\1/g, "'./ntwebterm/ntwebterm.js'");
    writeFileSync(path, text);
}
const vendor = new URL('ntwebterm/', dist);
mkdirSync(vendor, { recursive: true });
for (const name of readdirSync(new URL('dist/', upstream))) {
    if (/\.(js|wasm)$/.test(name) || name === 'ntwebterm.d.ts') {
        copyFileSync(new URL(`dist/${name}`, upstream), new URL(name, vendor));
    }
}
const types = new URL('ntwebterm.d.ts', vendor);
writeFileSync(types, '/// <reference types="@webgpu/types" />\n' + readFileSync(types, 'utf8'));
copyFileSync(new URL('LICENSE', upstream), new URL('LICENSE', vendor));
// The prebuilt JS contains these libraries; ship their original notices too.
const notices = new URL('licenses/', vendor);
mkdirSync(notices, { recursive: true });
for (const [name, license] of Object.entries({
    'bidi-js': 'LICENSE.txt', 'fast-png': 'LICENSE', iobuffer: 'LICENSE',
    pako: 'LICENSE', 'require-from-string': 'license',
})) {
    copyFileSync(new URL(`../node_modules/${name}/${license}`, import.meta.url), new URL(`${name}.txt`, notices));
}
copyFileSync(new URL('ghostty/LICENSE', upstream), new URL('ghostty.txt', notices));
writeFileSync(new URL('NOTICE.txt', vendor),
    `ntwebterm ${JSON.parse(readFileSync(new URL('package.json', upstream), 'utf8')).version}\n` +
    'Source: https://github.com/NimbleTerminal/ntwebterm\n' +
    `Built commit: ${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(upstream), encoding: 'utf8' }).trim()}\n` +
    'Runtime copied from the pinned prebuilt distribution. See LICENSE and licenses/.\n');
