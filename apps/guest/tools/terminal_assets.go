// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

// Command terminal_assets vendors the browser terminal (wterm) into the
// guest's embedded static directory. jsDelivr's ESM bundles import each other
// by absolute CDN path, so those imports are rewritten to the local copies and
// the guest serves the terminal without reaching the internet.
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const (
	wtermVersion  = "0.5.7"
	packageCDN    = "https://cdn.jsdelivr.net"
	staticDirMode = 0o755
	assetFileMode = 0o644
	exitFailure   = 1
	cdnImportPath = `"/npm/`

	terminalFontName = "ChivoMono-latin.woff2"
	// The terminal uses the dashboard's monospace font so both look the same.
	terminalFontSource = "../dashboard/src/lib/assets/fonts/" + terminalFontName
)

type asset struct {
	name     string
	path     string
	rewrites map[string]string
}

func assets() []asset {
	core := "/npm/@wterm/core@" + wtermVersion
	dom := "/npm/@wterm/dom@" + wtermVersion
	return []asset{
		{name: "wterm-dom.js", path: dom + "/+esm", rewrites: map[string]string{core + "/+esm": "/wterm-core.js"}},
		{name: "wterm-core.js", path: core + "/+esm", rewrites: map[string]string{core + "/dist/wasm-inline.js/+esm": "/wterm-wasm.js"}},
		{name: "wterm-wasm.js", path: core + "/dist/wasm-inline.js/+esm"},
		{name: "wterm.css", path: dom + "/src/terminal.css"},
	}
}

func main() {
	if err := run(context.Background()); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(exitFailure)
	}
	fmt.Println("terminal assets vendored successfully")
}

func run(ctx context.Context) error {
	staticDir := filepath.Join("internal", "terminal", "static")
	if err := os.MkdirAll(staticDir, staticDirMode); err != nil {
		return fmt.Errorf("create %s: %w", staticDir, err)
	}
	for _, item := range assets() {
		if err := vendor(ctx, item, filepath.Join(staticDir, item.name)); err != nil {
			return err
		}
	}
	return copyFile(terminalFontSource, filepath.Join(staticDir, terminalFontName))
}

func vendor(ctx context.Context, item asset, path string) error {
	fmt.Printf("Downloading %s...\n", path)
	body, err := download(ctx, packageCDN+item.path)
	if err != nil {
		return err
	}
	for from, to := range item.rewrites {
		if !strings.Contains(body, from) {
			return fmt.Errorf("%s: expected import %s was not found", item.name, from)
		}
		body = strings.ReplaceAll(body, `"`+from+`"`, `"`+to+`"`)
	}
	if strings.Contains(body, "from"+cdnImportPath) || strings.Contains(body, "import("+cdnImportPath) {
		return fmt.Errorf("%s still imports from the CDN", item.name)
	}
	if err := os.WriteFile(path, []byte(body), assetFileMode); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

func download(ctx context.Context, url string) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("build request for %s: %w", url, err)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("download %s: %w", url, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download %s: unexpected status %s", url, response.Status)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", url, err)
	}
	return string(body), nil
}

func copyFile(source, destination string) error {
	fmt.Printf("Copying %s...\n", destination)
	input, err := os.Open(source)
	if err != nil {
		return fmt.Errorf("open %s: %w", source, err)
	}
	output, err := os.Create(destination)
	if err != nil {
		return errors.Join(fmt.Errorf("create %s: %w", destination, err), input.Close())
	}
	_, copyErr := io.Copy(output, input)
	if err := errors.Join(copyErr, output.Close(), input.Close()); err != nil {
		return fmt.Errorf("copy %s to %s: %w", source, destination, err)
	}
	return nil
}
