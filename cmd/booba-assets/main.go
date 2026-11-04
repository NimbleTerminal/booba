// booba-assets sets up a web/ directory with everything needed to host
// a BubbleTea program compiled to WebAssembly.
//
// It writes:
//   - wasm_exec.js  — copied from the selected Go or TinyGo toolchain
//   - booba/*.js    — the terminal wrapper (embedded in this binary)
//   - ntwebterm/* — the ntwebterm terminal emulator (embedded)
//   - index.html    — a starter template (embedded), unless one exists
//
// Every asset except wasm_exec.js is embedded at compile time via the
// go-booba serve/static package, so the tool needs no module context,
// network access, or particular working directory — it runs anywhere.
// wasm_exec.js is copied from the selected toolchain because it must
// match the compiler that builds the user's app.wasm.
//
// Usage:
//
//	booba-assets [--toolchain go|tinygo] [--wasm-exec path] [--force] [--no-index] <output-dir>
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/spf13/pflag"

	"nimbleterminal.dev/booba/serve/static"
)

//go:embed template/index.html
var templateFS embed.FS

type assetOptions struct {
	force, noIndex      bool
	toolchain, wasmExec string
}

func main() {
	toolchain := pflag.String("toolchain", "go", "compiler supplying wasm_exec.js: go or tinygo")
	wasmExec := pflag.String("wasm-exec", "", "copy this wasm_exec.js instead of querying the toolchain")
	noIndex := pflag.Bool("no-index", false, "skip the starter index.html (even with --force)")
	force := pflag.BoolP("force", "f", false, "overwrite an existing index.html")
	pflag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: %s [--toolchain go|tinygo] [--wasm-exec path] [--force] [--no-index] <output-dir>\n\n", os.Args[0])
		fmt.Fprintln(os.Stderr, "Populates <output-dir> with wasm_exec.js, booba/, ntwebterm/,")
		fmt.Fprintln(os.Stderr, "and a starter index.html for hosting a BubbleTea WASM program.")
		pflag.PrintDefaults()
	}
	pflag.Parse()

	if pflag.NArg() != 1 {
		pflag.Usage()
		os.Exit(2)
	}
	if err := run(pflag.Arg(0), assetOptions{force: *force, noIndex: *noIndex, toolchain: *toolchain, wasmExec: *wasmExec}); err != nil {
		fmt.Fprintf(os.Stderr, "booba-assets: %v\n", err)
		os.Exit(1)
	}
}

func run(outDir string, opts assetOptions) error {
	// Resolve and read the shim before touching the destination. A missing
	// compiler or invalid override must not partially refresh existing assets.
	src, err := wasmExecPath(opts.toolchain, opts.wasmExec, toolchainEnv)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(src)
	if err != nil {
		return fmt.Errorf("read wasm_exec.js at %s: %w", src, err)
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}
	dst := filepath.Join(outDir, "wasm_exec.js")
	if err := os.WriteFile(dst, data, 0o644); err != nil {
		return fmt.Errorf("write wasm_exec.js: %w", err)
	}
	fmt.Printf("  wasm_exec.js          → %s (from %s)\n", dst, src)

	// booba/*.js (terminal wrapper) — embedded
	boobaDst := filepath.Join(outDir, "booba")
	n, err := copyEmbedded("booba", boobaDst, isJS)
	if err != nil {
		return fmt.Errorf("write booba assets: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("no embedded booba/*.js assets found — booba-assets build is corrupt")
	}
	fmt.Printf("  booba/ (%d files)      → %s\n", n, boobaDst)

	// ntwebterm (terminal emulator) — embedded
	ghDst := filepath.Join(outDir, "ntwebterm")
	n, err = copyEmbedded("ntwebterm", ghDst, isBrowserAsset)
	if err != nil {
		return fmt.Errorf("write ntwebterm assets: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("no embedded ntwebterm assets found — booba-assets build is corrupt")
	}
	// Sanity check: ensure all __vite- references are resolved.
	if err := checkViteReferences(filepath.Join(ghDst, "ntwebterm.js"), ghDst); err != nil {
		return fmt.Errorf("ntwebterm.js contains unresolved Vite references: %w", err)
	}
	fmt.Printf("  ntwebterm/ (%d files) → %s\n", n, ghDst)

	// Retain compatibility paths through the 0.12 namespace migration.
	if _, err := copyEmbedded("ghostty-web", filepath.Join(outDir, "ghostty-web"), isBrowserAsset); err != nil {
		return fmt.Errorf("write legacy terminal aliases: %w", err)
	}

	if opts.noIndex {
		return nil
	}

	// index.html (only if missing or --force)
	htmlDst := filepath.Join(outDir, "index.html")
	if _, err := os.Stat(htmlDst); err == nil && !opts.force {
		fmt.Printf("  index.html exists, skipped (use --force to overwrite)\n")
	} else {
		html, err := templateFS.ReadFile("template/index.html")
		if err != nil {
			return err
		}
		if err := os.WriteFile(htmlDst, html, 0o644); err != nil {
			return fmt.Errorf("write index.html: %w", err)
		}
		fmt.Printf("  index.html            → %s\n", htmlDst)
	}

	return nil
}

// wasmExecPath selects the shim matching the compiler used for app.wasm.
// An explicit file allows versioned/custom toolchains without changing PATH.
func wasmExecPath(toolchain, override string, env func(string, string) (string, error)) (string, error) {
	if toolchain == "" {
		toolchain = "go"
	}
	var key, relative string
	switch toolchain {
	case "go":
		key, relative = "GOROOT", filepath.Join("lib", "wasm", "wasm_exec.js")
	case "tinygo":
		key, relative = "TINYGOROOT", filepath.Join("targets", "wasm_exec.js")
	default:
		return "", fmt.Errorf("unknown toolchain %q: expected go or tinygo", toolchain)
	}
	if override != "" {
		return override, nil
	}
	root, err := env(toolchain, key)
	if err != nil {
		return "", fmt.Errorf("locate %s using %s env %s (or specify --wasm-exec): %w", key, toolchain, key, err)
	}
	if root == "" {
		return "", fmt.Errorf("%s env %s returned an empty path", toolchain, key)
	}
	return filepath.Join(root, relative), nil
}

// copyEmbedded writes every file in the embedded directory subdir for
// which keep(name) reports true into dstDir, returning the count written.
func copyEmbedded(subdir, dstDir string, keep func(name string) bool) (int, error) {
	entries, err := fs.ReadDir(static.FS, subdir)
	if err != nil {
		return 0, err
	}
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		return 0, err
	}
	count := 0
	for _, e := range entries {
		if e.IsDir() || !keep(e.Name()) {
			continue
		}
		data, err := static.FS.ReadFile(path.Join(subdir, e.Name()))
		if err != nil {
			return count, err
		}
		if err := os.WriteFile(filepath.Join(dstDir, e.Name()), data, 0o644); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func isJS(name string) bool { return strings.HasSuffix(name, ".js") }

// isBrowserAsset keeps the runtime .js and .wasm files, skipping type
// definitions, source maps, and the UMD bundle.
func isBrowserAsset(name string) bool {
	if strings.HasSuffix(name, ".d.ts") ||
		strings.HasSuffix(name, ".d.ts.map") ||
		strings.HasSuffix(name, ".js.map") ||
		strings.HasSuffix(name, ".cjs") {
		return false
	}
	return strings.HasSuffix(name, ".js") || strings.HasSuffix(name, ".wasm")
}

func toolchainEnv(toolchain, name string) (string, error) {
	out, err := exec.Command(toolchain, "env", name).Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// checkViteReferences verifies that all __vite- references in jsFile are
// resolved (i.e., the referenced files exist in dstDir). This catches
// regressions where Vite-generated filenames change after a rebuild.
func checkViteReferences(jsFile, dstDir string) error {
	content, err := os.ReadFile(jsFile)
	if err != nil {
		return err
	}

	viteRe := regexp.MustCompile(`__vite-[A-Za-z0-9.\-]+`)
	for _, filename := range viteRe.FindAllString(string(content), -1) {
		if _, err := os.Stat(filepath.Join(dstDir, filename)); err != nil {
			return fmt.Errorf("referenced file not found: %s", filename)
		}
	}
	return nil
}
