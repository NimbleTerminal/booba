# JavaScript distribution

v0.12.0 publication is pending. The JavaScript package `@nimbleterminal/booba`
will be published to GitHub Packages. Native binary archives remain on GitHub
Releases. npmjs.com distribution is deferred and is not a release prerequisite.

## Package contents

`npm run build` compiles Booba and copies the pinned ntwebterm prebuilt ESM runtime,
Vite chunks, declarations, WASM, and license notices into `dist/ntwebterm/`.
Both JS and declaration imports are rewritten to relative paths. The only published
dependency is `@webgpu/types`, needed by the renderer declarations. The local
`file:third_party/ntwebterm` dependency is development-only. Consumers do not need
Git, the submodule, Bun, Zig, or a separately published ntwebterm package.

The package is ESM and browser-oriented; import from `@nimbleterminal/booba`.
The upstream bundle loads its inline WASM payload by default. There is no runtime
CDN dependency. The standalone binary is also exported as
`@nimbleterminal/booba/ghostty-vt.wasm` for applications that need to copy/serve it.
This is the terminal engine, not the application's Go WASM.
Source maps are omitted because packaging rewrites imports after compilation.

Build prerequisites are `git submodule update --init --recursive` and `npm ci`.
`npm pack` runs the build through `prepack`, preventing stale dist files from
being shipped. `npm run test:package` installs that tarball in a temporary project
outside the checkout, checks JS imports and strict NodeNext/Bundler declarations,
and exercises the real default and exported WASM. The Node harness supplies
`self.location` for the browser bundle and rejects non-data WASM fetches.
It does not substitute for interactive browser rendering tests.

## Go and TinyGo applications

The developer chooses the compiler for their app. This package ships neither
`app.wasm` nor `wasm_exec.js`, so it does not tie the app to standard Go or TinyGo.
The `connectWasm()` bridge expects `bubbletea_read`, `bubbletea_write`, and
`bubbletea_resize` globals, plus the documented exit notifications; arbitrary
WASM exports alone do not implement that interface.

`booba-assets` selects the runtime shim from the compiler you specify:

```sh
go tool booba-assets web/                     # standard Go (default)
go tool booba-assets --toolchain tinygo web/  # TinyGo from PATH
```

Standard Go uses `go env GOROOT` plus `lib/wasm/wasm_exec.js`; TinyGo uses
`tinygo env TINYGOROOT` plus `targets/wasm_exec.js`. Use the same compiler
installation and environment that built your app. For a versioned or custom
installation, provide the file directly (no compiler lookup is then needed):

```sh
go tool booba-assets --wasm-exec /path/to/compiler/wasm_exec.js web/
```

These options also work with the standalone `booba-assets` binary. The output
reports the source path. Repeat the selection on each scaffold run; the tool
cannot infer the compiler from app.wasm. It reads the shim before changing any
output, so an invalid selection leaves existing assets untouched.

TinyGo documents the requirement to match its shim to its compiler in
[Using WASM](https://tinygo.org/docs/guides/webassembly/wasm/).
This shim choice is necessary, but does not establish that a particular app,
Bubble Tea version, or Booba Go bridge compiles and runs with TinyGo. That needs
a representative TinyGo build-and-browser test. The current demo generator uses
standard Go.

## Publishing setup (not enabled yet)

The release workflow checks the tag against package.json and requires the binary
release job to succeed. Enable `RELEASE_ENABLED=true` and
`GH_PACKAGES_ENABLED=true` only after the release gates pass. Historical tag
imports still require disabling Actions at repository level, because old commits
contain old workflows without these guards.

Publishing uses the repository's `GITHUB_TOKEN` with `packages: write`.
Confirm the organization permits package creation and the repository has package
access. package.json links the package to `NimbleTerminal/booba` and sets
`publishConfig.registry` to `https://npm.pkg.github.com`; the workflow also selects
that registry explicitly. No npmjs organization, token, or environment is needed.

After the first publication, check the package settings and make its visibility
public as intended; GitHub documents private as the initial default. Do not assume
`--access=public` alone establishes GitHub package visibility. Verify repository
linkage and Actions access there as well.

## Installing from GitHub Packages

After publication, add this scope route to the consumer project's `.npmrc`:

```ini
@nimbleterminal:registry=https://npm.pkg.github.com
```

Authenticate interactively using your GitHub username and a personal access token
(classic) with `read:packages` as the password. GitHub requires authentication even
for public npm packages. Keep credentials out of the project's tracked files.

```sh
npm login --scope=@nimbleterminal --auth-type=legacy --registry=https://npm.pkg.github.com
npm install @nimbleterminal/booba@0.12.0
```

The scope route leaves unrelated dependencies on their normal registry. Verify
installation in a fresh consumer project after publication, including JS imports,
TypeScript declarations, and WASM loading. Local tarball tests do not verify remote
registry access. See [GitHub's npm registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

## Deferred npmjs.com distribution

There is no npmjs publishing job in this release workflow. When the npm organization
is ready, add npmjs.com as a separate target, configure its publishing credentials
or trusted publisher, and revisit the GitHub-specific `publishConfig.registry`.
Validate both registry targets before enabling automatic publication.
No publication or remote configuration is performed by the local build/tests.
