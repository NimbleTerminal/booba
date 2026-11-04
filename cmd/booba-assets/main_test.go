package main

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

func TestRunCopiesViteChunks(t *testing.T) {
	out := t.TempDir()
	if err := run(out, assetOptions{}); err != nil {
		t.Fatal(err)
	}

	// Existing assets present
	for _, name := range []string{"ntwebterm/ntwebterm.js", "ntwebterm/ghostty-vt.wasm", "ghostty-web/ghostty-web.js", "ghostty-web/ghostty-vt.wasm"} {
		if _, err := os.Stat(filepath.Join(out, name)); err != nil {
			t.Errorf("missing %s: %v", name, err)
		}
	}

	// Every __vite- reference in ntwebterm.js has a matching shipped file.
	// This catches regressions where Vite-generated filenames change but the
	// .gitignore whitelist wasn't updated or the files weren't committed.
	js, err := os.ReadFile(filepath.Join(out, "ntwebterm/ntwebterm.js"))
	if err != nil {
		t.Fatal(err)
	}

	re := regexp.MustCompile(`__vite-[A-Za-z0-9.\-]+`)
	for _, ref := range re.FindAllString(string(js), -1) {
		if _, err := os.Stat(filepath.Join(out, "ntwebterm", ref)); err != nil {
			t.Errorf("ntwebterm.js references %s but it isn't shipped (check .gitignore whitelist and make sure Vite chunks are committed)", ref)
		}
	}
}

func TestWasmExecPath(t *testing.T) {
	root := t.TempDir()
	for _, tc := range []struct {
		name, compiler, key, relative string
	}{
		{"default", "", "GOROOT", filepath.Join("lib", "wasm", "wasm_exec.js")},
		{"go", "go", "GOROOT", filepath.Join("lib", "wasm", "wasm_exec.js")},
		{"tinygo", "tinygo", "TINYGOROOT", filepath.Join("targets", "wasm_exec.js")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := wasmExecPath(tc.compiler, "", func(compiler, key string) (string, error) {
				wantCompiler := tc.compiler
				if wantCompiler == "" {
					wantCompiler = "go"
				}
				if compiler != wantCompiler || key != tc.key {
					t.Fatalf("queried %s env %s", compiler, key)
				}
				return root, nil
			})
			if err != nil || got != filepath.Join(root, tc.relative) {
				t.Fatalf("got %q, %v", got, err)
			}
		})
	}
	neverQuery := func(string, string) (string, error) {
		t.Fatal("must not query toolchain")
		return "", nil
	}
	if got, err := wasmExecPath("tinygo", "custom.js", neverQuery); err != nil || got != "custom.js" {
		t.Fatalf("explicit override: %q, %v", got, err)
	}
	if _, err := wasmExecPath("typo", "custom.js", neverQuery); err == nil {
		t.Fatal("accepted unknown toolchain")
	}
	for _, tc := range []struct {
		name string
		err  error
	}{
		{"empty", nil}, {"missing", os.ErrNotExist},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := wasmExecPath("tinygo", "", func(string, string) (string, error) { return "", tc.err })
			if err == nil {
				t.Fatal("accepted unavailable toolchain root")
			}
		})
	}
}

func TestRunExplicitShimAndIndexPolicy(t *testing.T) {
	src := filepath.Join(t.TempDir(), "custom runtime.js")
	const shim = "// runtime from the app compiler\n"
	if err := os.WriteFile(src, []byte(shim), 0o644); err != nil {
		t.Fatal(err)
	}
	out := t.TempDir()
	index := filepath.Join(out, "index.html")
	if err := os.WriteFile(index, []byte("custom page"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, opts := range []assetOptions{
		{toolchain: "tinygo", wasmExec: src},
		{toolchain: "tinygo", wasmExec: src, force: true, noIndex: true},
	} {
		if err := run(out, opts); err != nil {
			t.Fatal(err)
		}
		got, err := os.ReadFile(filepath.Join(out, "wasm_exec.js"))
		if err != nil || string(got) != shim {
			t.Fatalf("shim: %q, %v", got, err)
		}
		got, err = os.ReadFile(index)
		if err != nil || string(got) != "custom page" {
			t.Fatalf("index: %q, %v", got, err)
		}
	}
}

func TestRunMissingShimLeavesDestinationUntouched(t *testing.T) {
	out := t.TempDir()
	dst := filepath.Join(out, "wasm_exec.js")
	if err := os.WriteFile(dst, []byte("existing shim"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := run(out, assetOptions{wasmExec: filepath.Join(out, "missing.js")}); err == nil {
		t.Fatal("accepted missing shim")
	}
	got, err := os.ReadFile(dst)
	if err != nil || string(got) != "existing shim" {
		t.Fatalf("existing shim: %q, %v", got, err)
	}
	entries, err := os.ReadDir(out)
	if err != nil || len(entries) != 1 {
		t.Fatalf("modified destination: %v, %v", entries, err)
	}
}
