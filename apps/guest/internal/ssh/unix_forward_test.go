// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package ssh

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

const regularFileMode = 0o600

func TestAllowedSocketPathConfinesForwards(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{filepath.Join(home, "app.sock"), filepath.Join(os.TempDir(), "app", "app.sock")} {
		if err := allowedSocketPath(path); err != nil {
			t.Errorf("allowedSocketPath(%q) = %v, want nil", path, err)
		}
	}
	for _, path := range []string{"relative.sock", "/etc/app.sock", filepath.Join(home, "..", "escape.sock"), home} {
		if err := allowedSocketPath(path); err == nil {
			t.Errorf("allowedSocketPath(%q) accepted a path outside the allowed roots", path)
		}
	}
}

func TestListenUnixRefusesToReplaceRegularFiles(t *testing.T) {
	path := filepath.Join(t.TempDir(), "regular")
	if err := os.WriteFile(path, nil, regularFileMode); err != nil {
		t.Fatal(err)
	}
	if listener, err := listenUnix(context.Background(), path); err == nil {
		t.Fatalf("listenUnix replaced a regular file with %v", listener.Addr())
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("the regular file was removed: %v", err)
	}
}
