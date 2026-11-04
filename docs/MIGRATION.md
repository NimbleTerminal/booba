# v0.12.0 migration checkpoint

Publication is pending. Do not treat the version in package.json as a published release.
No push, remote release, or archive operation has been performed by the migration agent.

## Local history and destinations

- Source checkout: `/Users/evan/projects/go-booba`, clean at import.
- Imported main: `21e15c07620a5f57a85f1934680d02521f55a811`.
- Working branch: `migration/vanity-v0.12.0`.
- `origin`: `git@github.com:NimbleTerminal/booba.git` (original main and historical tags imported).
- `legacy`: `git@github.com:NimbleMarkets/go-booba.git`.
- All 28 local release tag object IDs match the source checkout, unchanged.
- Development refs retained under `refs/remotes/legacy/`: `fix/osc52-wasm`,
  `nm-bubbletea-wasm`, and `rtl-text`. All are already ancestors of imported main.
  Their commits are preserved through main; destination branch names were omitted.
- The user imported main and all 28 historical tags with Actions disabled. Source,
  destination, and local IDs match, including peeled tags. Actions is restored;
  release publishing remains disabled.
- Only one tracked Go module was found. Binary and package names are unchanged.

The canonical module is `nimbleterminal.dev/booba`, not the GitHub URL.
Historical tags still declare `github.com/NimbleMarkets/go-booba`; use v0.12.0
or later for the vanity path. v0.11.0 is the latest inspected old-path tag.
Old release descriptions and attachments remain at
https://github.com/NimbleMarkets/go-booba/releases.

## Vanity verification

On 2026-11-03, `task check MODULE=booba` passed in NimbleTerminal-infra.
Both root and `/booba/serve?go-get=1` discovery returned:

```html
<meta name="go-import" content="nimbleterminal.dev/booba git https://github.com/NimbleTerminal/booba">
```

The existing uncommitted infrastructure mapping already contains
`booba = "https://github.com/NimbleTerminal/booba"` and is live.
Infrastructure files were left untouched; no new plan or deployment was needed.

## Completed preparation

1. ntwebterm refresh completed locally: built
   `fa8b2aecd00f326b29e7c4f7765a221a3b6274c3`, source
   `f65a610ceed7133b1136e94f0a1483858659294e` (v0.4.1).
   The built commit's parent is the source; only generated distribution files
   were added. [Artifact CI run](https://github.com/NimbleTerminal/ntwebterm/actions/runs/41725357818)
   completed successfully for that source. The `static/ghostty-web/` alias remains.
2. npm distribution implementation is complete locally: runtime and declarations
   use vendored relative imports; licenses and standalone WASM are included.
   `npm run test:package` passes outside the source checkout with strict
   NodeNext/Bundler declarations and real WASM loading. GitHub Packages remains
   unpublished; package access setup is pending. npmjs.com is deferred.
   See [NPM.md](NPM.md) for the exact publishing identities and switches.
3. Full local tests/builds, snapshot archives, embedded-asset reproducibility,
   and desktop browser smoke checks passed. See [RELEASE_VALIDATION.md](RELEASE_VALIDATION.md)
   for source IDs, observed behavior, limitations, and remaining release steps.
4. Historical main and tags were imported and verified without changes. Actions
   was disabled during import and restored afterward. Migration commits remain local.

## Remaining release gates

1. Configure branch protection, Actions permissions, Pages (`/booba`), package
   access, and signing/notarization secrets without exposing values.
   `RELEASE_ENABLED=true` opts into binary releases;
   `GH_PACKAGES_ENABLED=true` separately opts into GitHub Packages publishing.
   Leave both unset until their prerequisites pass. npmjs.com publication is
   deferred and does not block this release.
2. The user pushes the prepared branch. Require successful CI, then verify the
   pushed commit from a temporary module with GOWORK=off and no Booba replacement.
   Consumers must explicitly include the pinned Bubble Tea replacement in go.mod.
3. Only then create v0.12.0 once and have the user push the tag. Verify binaries,
   GitHub Packages and https://nimbleterminal.github.io/booba/.
   Archives are explicitly named `booba_0.12.0_<os>_<arch>.tar.gz` (Windows `.zip`).
4. Test `go mod download -json nimbleterminal.dev/booba@v0.12.0` both with
   GOPROXY=direct and normal public proxy/checksum settings; compile a consumer.
   Prepare downstream updates for gloss, ntfilepicker, nt3d, ntmaps and thinkt.
5. After a released consumer succeeds, add the old-repository migration notice
   and archive it, retaining all tags and release assets. This has not happened.

## Namespace checkpoint validation

Passed: `go mod tidy` (no go.sum changes), `go test ./...`, `go vet ./...`,
`task go-lint` (zero issues), `goreleaser check`, and `git diff --check`.
`task go-test-wasm` initially failed because the host exports TERM_PROGRAM=rex;
`env -u TERM_PROGRAM -u COLORTERM task go-test-wasm` passed. The existing
TestEnvDefaults assumes those variables are absent; production preserves overrides.
The website rendering tests passed with `/booba` and the unchanged separate
`NimbleMarkets/go-booba-example` link.

## ntwebterm refresh validation

Passed `task --force build-serve-assets`, `task test`, `task build`, and
`task build-npm`. Tests ran with TERM_PROGRAM and COLORTERM unset as above:
24 TypeScript test files / 163 tests, native Go tests, and js/wasm tests passed.
The real embedded bundle/WASM tests cover terminal parsing, cursor reports,
Kitty shared-memory image decoding, and legacy import/WASM compatibility.
Only ntwebterm.js changed among runtime assets; WASM and Vite chunks are unchanged.
A second forced regeneration was byte-identical, and every embedded ntwebterm
runtime file matches the pinned distribution. `git diff --check` passed.
The lockfile records the installed local ntwebterm package as 0.4.1.
Subsequent desktop browser rendering, paste, resize, scrollback, and renderer
smoke checks passed; see RELEASE_VALIDATION.md for coverage and limitations.

## npm packaging checkpoint validation

Passed after a clean `npm ci`: `npm run test:package`, `npm test` (24 files,
163 tests), `actionlint`, and `git diff --check`. The fresh consumer installs
only Booba and its WebGPU declaration dependency, then checks strict NodeNext
and Bundler declarations, JavaScript imports, default inline WASM loading and
exported standalone WASM parsing. No registry publication was attempted.
Desktop browser smoke checks subsequently passed; remote CI remains pending.
See NPM.md for the separate
Go/TinyGo runtime-shim boundary and publication setup.
