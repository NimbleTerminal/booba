# v0.12.0 migration checkpoint

Publication is pending. Do not treat the version in package.json as a published release.
No push, remote release, or archive operation has been performed by the migration agent.

## Local history and destinations

- Source checkout: `/Users/evan/projects/go-booba`, clean at import.
- Imported main: `21e15c07620a5f57a85f1934680d02521f55a811`.
- Working branch: `migration/vanity-v0.12.0`.
- `origin`: `git@github.com:NimbleTerminal/booba.git` (empty at inspection).
- `legacy`: `git@github.com:NimbleMarkets/go-booba.git`.
- All 28 local release tag object IDs match the source checkout, unchanged.
- Development refs retained under `refs/remotes/legacy/`: `fix/osc52-wasm`,
  `nm-bubbletea-wasm`, and `rtl-text`. All are already ancestors of imported main.
  Keep named branch refs in the eventual import for discoverability.
- Remote legacy refs still need a fresh comparison before the user's import.
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

## Remaining release gates

1. ntwebterm refresh completed locally: built
   `fa8b2aecd00f326b29e7c4f7765a221a3b6274c3`, source
   `f65a610ceed7133b1136e94f0a1483858659294e` (v0.4.1).
   The built commit's parent is the source; only generated distribution files
   were added. [Artifact CI run](https://github.com/NimbleTerminal/ntwebterm/actions/runs/41725357818)
   completed successfully for that source. The `static/ghostty-web/` alias remains.
2. Fix npm distribution: the local devDependency `file:third_party/ntwebterm`
   cannot satisfy emitted bare imports in consumer projects. Inspect JS and
   declarations, provide portable runtime/types/WASM, pack, and test a fresh
   consumer. ntwebterm registry availability has not been established.
3. Run full `task test`, `task build`, `task build-npm`, snapshot release,
   asset reproducibility, generated-site and interactive browser checks.
4. Before importing ANY historical tags, disable Actions on the destination.
   New workflow guards do not protect workflows stored in historical commits.
   Import explicit branches and unchanged tags, never `push --mirror`.
   Compare source/destination object IDs, then restore Actions.
5. Configure branch protection, Actions permissions, Pages (`/booba`), package
   access, and signing/notarization secrets without exposing values.
   `RELEASE_ENABLED=true` opts into binary releases;
   `GITHUB_PACKAGES_ENABLED=true` separately opts into GitHub Packages publishing.
   Leave both unset until their prerequisites pass. npmjs.com is a separate,
   currently unconfigured target; do not enable it implicitly.
6. The user pushes the prepared branch. Require successful CI, then verify the
   pushed commit from a temporary module with GOWORK=off and no Booba replacement.
   Consumers must explicitly include the pinned Bubble Tea replacement in go.mod.
7. Only then create v0.12.0 once and have the user push the tag. Verify binaries,
   GitHub Packages and https://nimbleterminal.github.io/booba/.
   Archives are explicitly named `booba_0.12.0_<os>_<arch>.tar.gz` (Windows `.zip`).
8. Test `go mod download -json nimbleterminal.dev/booba@v0.12.0` both with
   GOPROXY=direct and normal public proxy/checksum settings; compile a consumer.
   Prepare downstream updates for gloss, ntfilepicker, nt3d, ntmaps and thinkt.
9. After a released consumer succeeds, add the old-repository migration notice
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
Interactive browser rendering, paste, resize, scrollback, and renderer checks
remain part of the release validation gate; unit tests do not establish those.
