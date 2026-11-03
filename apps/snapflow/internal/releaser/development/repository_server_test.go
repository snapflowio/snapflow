// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package development

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

const (
	testMetadataName = "timestamp.json"
	testMetadataBody = `{"signed":{}}`
	testFileMode     = 0o644
	testDirMode      = 0o755
)

func TestRepositoryServerServesOnlyRepositoryFiles(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "metadata"), testDirMode); err != nil {
		t.Fatalf("create metadata directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "metadata", testMetadataName), []byte(testMetadataBody), testFileMode); err != nil {
		t.Fatalf("write metadata: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "secret"), []byte(testMetadataBody), testFileMode); err != nil {
		t.Fatalf("write secret: %v", err)
	}
	server, err := startRepositoryServer(t.Context(), root)
	if err != nil {
		t.Fatalf("startRepositoryServer() error = %v", err)
	}
	t.Cleanup(func() {
		if err := server.Close(t.Context()); err != nil {
			t.Errorf("Close() error = %v", err)
		}
	})
	tests := map[string]struct {
		method string
		path   string
		status int
	}{
		"metadata file":         {method: http.MethodGet, path: "/metadata/" + testMetadataName, status: http.StatusOK},
		"metadata head":         {method: http.MethodHead, path: "/metadata/" + testMetadataName, status: http.StatusOK},
		"file outside the tree": {method: http.MethodGet, path: "/secret", status: http.StatusNotFound},
		"unclean path":          {method: http.MethodGet, path: "/metadata/../secret", status: http.StatusNotFound},
		"query string":          {method: http.MethodGet, path: "/metadata/" + testMetadataName + "?x=1", status: http.StatusNotFound},
		"directory":             {method: http.MethodGet, path: "/metadata", status: http.StatusNotFound},
		"write method":          {method: http.MethodPost, path: "/metadata/" + testMetadataName, status: http.StatusMethodNotAllowed},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			request, err := http.NewRequestWithContext(t.Context(), test.method, server.Origin()+test.path, nil)
			if err != nil {
				t.Fatalf("create request: %v", err)
			}
			response, err := http.DefaultClient.Do(request)
			if err != nil {
				t.Fatalf("request: %v", err)
			}
			body, readErr := io.ReadAll(response.Body)
			if err := response.Body.Close(); err != nil || readErr != nil {
				t.Fatalf("read response: %v %v", readErr, err)
			}
			if response.StatusCode != test.status {
				t.Fatalf("status = %d, want %d", response.StatusCode, test.status)
			}
			if test.status == http.StatusOK && test.method == http.MethodGet && string(body) != testMetadataBody {
				t.Fatalf("body = %q", body)
			}
		})
	}
}
