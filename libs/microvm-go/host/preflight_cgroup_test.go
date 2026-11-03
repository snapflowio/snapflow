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

package host

import (
	"os"
	"path/filepath"
	"testing"
)

const (
	cgroupFileMode        = 0o600
	jailControllerSet     = "cpuset cpu io memory pids"
	controllersWithoutMem = "cpu io pids"
)

func writeCgroupFiles(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(root, name), []byte(content+"\n"), cgroupFileMode); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	return root
}

func TestValidateJailCgroupAt(t *testing.T) {
	cases := []struct {
		name        string
		controllers string
		wantErr     bool
	}{
		{name: "all limit controllers", controllers: jailControllerSet},
		{name: "memory controller missing", controllers: controllersWithoutMem, wantErr: true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			err := validateJailCgroupAt(writeCgroupFiles(t, map[string]string{"cgroup.controllers": testCase.controllers}))
			if (err != nil) != testCase.wantErr {
				t.Fatalf("validateJailCgroupAt() error = %v, wantErr %v", err, testCase.wantErr)
			}
		})
	}
}
