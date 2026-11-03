// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package clitest

import (
	"bytes"
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/snapflow/internal/cli/style"
)

const (
	directory     = "testdata"
	extension     = ".golden"
	fileMode      = 0o644
	directoryMode = 0o755
)

var update = flag.Bool("update", false, "rewrite golden files") //nolint:gochecknoglobals // go test parses test flags before tests run, so they must be registered at package scope

func Assert(t *testing.T, name, rendered string) {
	t.Helper()
	var buffer bytes.Buffer
	if written, err := style.PlainWriter(&buffer).WriteString(rendered + "\n"); err != nil {
		t.Fatalf("strip styles after %d bytes: %v", written, err)
	}
	path := filepath.Join(directory, name+extension)
	if *update {
		if err := os.MkdirAll(directory, directoryMode); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, buffer.Bytes(), fileMode); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s (run with -update to create it): %v", path, err)
	}
	if got := buffer.String(); got != string(want) {
		t.Fatalf("%s does not match:\n--- got\n%s\n--- want\n%s", path, got, want)
	}
}
