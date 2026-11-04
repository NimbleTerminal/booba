# v0.12.0 local validation and import handoff

Validated 2026-11-03 on branch `migration/vanity-v0.12.0`.
Curated product source: `07c5d1352973a177d09e69309a06d5e631048d70`.
Full validation originally ran at `c05b084ec809dca3f2b3e3083b9827cf240adc38`;
GitHub-only publishing configuration was subsequently checked with actionlint and
the packed-consumer test. Curation preserves the final code, configuration, and
assets byte-for-byte; it does not constitute a new full test run.
ntwebterm built: `fa8b2aecd00f326b29e7c4f7765a221a3b6274c3` (v0.4.1).
ntwebterm source: `f65a610ceed7133b1136e94f0a1483858659294e`.
This report and manual harness are added after that tested product commit.
The user imported original main and historical tags; verification is recorded below.
The migration branch remains unpushed. No new release tag, publication, or archive
operation has been performed.

## Automated checks

Passed:

- `env -u TERM_PROGRAM -u COLORTERM task test build build-npm site`:
  native Go and js/wasm tests; 24 TypeScript files / 163 tests;
  command builds, npm build, and all five generated demo pages.
- `go mod tidy`, `go vet ./...`, `task go-lint` (zero issues).
- `goreleaser check` and `goreleaser release --snapshot --clean`.
- Embedded asset regeneration left `serve/static/` unchanged; go.mod/go.sum unchanged.
- All six snapshot archives contain booba, booba-assets, and booba-sip-client
  (with .exe on Windows). SHA-256 checksums verified.
- Earlier isolated packed-consumer checks passed; see MIGRATION.md.

Local builds used Go 1.27.3 and Node 26.13.0 on macOS arm64. The lint task uses
the go.mod toolchain. CI's pinned Go and Node 24 execution remains to be verified.
Snapshot archives were saved under `bin/release-snapshot/`, named `booba_0.11.0-SNAPSHOT-c05b084_*` because
v0.11.0 is the latest Git tag; v0.12.0 has deliberately not been created.
Signing/notarization were disabled; the snapshot does not validate credentials
or notarization. `npm run build` and GoReleaser both own dist/, so save snapshot
artifacts elsewhere before rebuilding npm if you need to retain them.

## Browser checks

Chrome 156.0.8078.80 on macOS, DPR 2, serving the generated site at
`http://127.0.0.1:8098/booba/`. Checks used native Chrome UI and canvas screenshots.

| Check | Result |
| --- | --- |
| Overview and project URLs | `/booba/` navigation, new repository and vanity documentation links correct; separate old example-repository link retained |
| Multiple views | WASM loads, keyboard selection enters Loading state, restart works, exit frame displayed |
| Terminal Actions | Open changes controls to Confirm/Back and revision 2; Confirm returns to files/revision 3 |
| Mouse tracking | Click yields one press and one release; wheel yields SGR mouse-down event and increments counter |
| Colors | RGB samples and gradients visible on WebGPU |
| RTL | Styled Hebrew red word on right, blue on left; labels stay LTR. Disconnected Arabic/Persian shaping remains the documented limitation |
| Text and Kitty graphics | Manual harness shows ANSI styling, continuous box borders, Japanese text, emoji, and red/green/blue/white image on Canvas2D, WebGL, and WebGPU |
| Paste | API and native clipboard paste deliver exact bracketed-paste sequences; no extra Ctrl+V byte observed |
| Resize | WebGPU harness changes 88 → 46 → 88 columns at constant 14 rows |
| Scrollback | 120-line output: top displays ROW 000 with viewport offset 107; bottom restores offset 0. Canvas2D wheel scrolling moves into history |

The desktop clipboard tool reported a timeout waiting for acknowledgment, but
the page's input log independently confirmed both paste attempts arrived correctly.
The manual harness reported no captured error/unhandled-rejection events.
These are desktop smoke checks, not exhaustive mobile, touch, browser, GPU,
transport, or graphics-protocol coverage. No full TinyGo app was compiled or run.

Reproduce after `task site`: copy `web/` into `bin/validation-site/booba/`, copy
`scripts/browser-smoke.html` to `bin/validation-site/booba/check.html`, and serve
`bin/validation-site/` on loopback. Open `/booba/` and
`/booba/check.html?renderer=webgpu` (also `webgl` and `canvas2d`).
The harness uses the generated production runtime without modifying it. It is
not part of the Pages build or npm package.

## Completed history import

On 2026-11-03, the user pushed original main and all 28 historical tags to
NimbleTerminal/booba while Actions was disabled. Source, destination, and local
main/tag IDs were then compared successfully, including peeled annotated tags.
Original main remains `21e15c07620a5f57a85f1934680d02521f55a811`.
The development tips nm-bubbletea-wasm, rtl-text, and fix/osc52-wasm are all
ancestors of main; their history is preserved without creating destination branches.
Local legacy remote-tracking refs retain those names.

Actions has been restored to enabled with all actions allowed. RELEASE_ENABLED
and GH_PACKAGES_ENABLED remain unset/false. Pages, package access, branch protection,
and signing/notarization setup still need completion. At inspection, there were no
repository variables or repository secrets. The prior Actions policy and source
ref inventory were saved locally in `bin/history-import/`.

The historical tag import bypassed the optional pre-push hook because it compares
tag versions with the current working-tree package.json. No historical tag was
changed. The original repository and its release assets remain available.

## Remaining user-operated release steps

1. Review the five curated migration commits, then push the branch for CI:

   ```sh
   git push -u origin migration/vanity-v0.12.0
   ```

2. Require successful CI. Configure branch protection, Actions permissions, Pages
   with GitHub Actions and the github-pages environment, package access, and
   signing/notarization credentials. See NPM.md for GitHub Packages setup;
   npmjs.com is deferred. Do not expose secrets. Review and merge into main.
3. Test the pushed migration commit via the vanity path from a clean consumer
   using GOWORK=off, without a Booba replace. Use the documented Bubble Tea
   replacement; the dependency's own replace directive does not propagate.
4. Only after those gates pass, enable the intended publication jobs and create
   v0.12.0 once. The user pushes it. Verify actual release binaries, package
   visibility and authenticated installs from GitHub Packages, direct/public-proxy
   Go downloads, Pages deployment, and a representative downstream migration.
5. Add the legacy README notice and archive the original repository last.
   Keep its historical tags, release descriptions, and attachments available.
