// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package builds

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/snapflowio/microvm-go/layout"
)

func TestWriteBuildLogsPersistsPublicAndDiagnosticLogs(t *testing.T) {
	root := t.TempDir()
	publicLog := filepath.Join(root, "public", "build.log")
	manager := &Manager{
		config: Config{LogPath: func(imageRef string) (string, error) {
			if imageRef != "example.test/app:v1" {
				t.Fatalf("imageRef = %q", imageRef)
			}
			return publicLog, nil
		}},
		paths: layout.NewPaths(root),
	}
	buildDir := filepath.Join(root, "internal")
	if err := os.MkdirAll(buildDir, 0o700); err != nil {
		t.Fatal(err)
	}
	result := buildLog{progress: "build output\n", builder: BuilderLogs{Application: "daemon output\n", VMM: "vmm output\n"}}
	if err := manager.writeBuildLogs(
		context.Background(),
		buildDir,
		"example.test/app:v1",
		"",
		result,
	); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(publicLog)
	if err != nil {
		t.Fatal(err)
	}
	content := string(data)
	for _, want := range []string{"build output", builderLogHeader, "daemon output", builderVMMLogHeader, "vmm output"} {
		if !strings.Contains(content, want) {
			t.Fatalf("public build log = %q, missing %q", content, want)
		}
	}
	info, err := os.Stat(publicLog)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("public log mode = %o", info.Mode().Perm())
	}
}
