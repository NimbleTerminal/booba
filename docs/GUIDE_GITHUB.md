# Hosting a BubbleTea Program on GitHub Pages

See **[NimbleTerminal/booba-example](https://github.com/NimbleTerminal/booba-example)** —
a complete, forkable example that compiles a BubbleTea program to WebAssembly
and deploys it to GitHub Pages. No backend server needed.

The example repo includes:

- A working BubbleTea program with both native and WASM entry points
- A GitHub Actions workflow that builds the WASM binary and deploys to Pages
- Standard Go WASM builds and a pinned `booba-assets` Go tool dependency
- An `index.html` that wires up ntwebterm and booba's WASM adapter

The example carries the Bubble Tea replacement required by Booba and uses
`booba-assets` to copy the matching Go runtime shim and bundled ntwebterm assets.

Fork it, enable Pages (Settings → Pages → Source: GitHub Actions), and push.
