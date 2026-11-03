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

//go:build linux

package guestinit

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	mobyuser "github.com/moby/sys/user"
)

const (
	testUser      = "snapflow"
	testFileMode  = 0o644
	basePasswd    = "root:x:0:0:root:/root:/bin/sh\nubuntu:x:1000:1000::/home/ubuntu:/bin/sh"
	baseGroup     = "root:x:0:\nubuntu:x:1000:"
	expectedID    = 1001
	unrelatedUser = "1000:1000"
)

type chownCall struct {
	path     string
	uid, gid int
}

func testAccountFiles(t *testing.T, passwd, group string) (accountFiles, *[]chownCall) {
	t.Helper()
	root := t.TempDir()
	files := accountFiles{
		passwd: filepath.Join(root, "passwd"),
		group:  filepath.Join(root, "group"),
		home:   filepath.Join(root, "home"),
	}
	for path, content := range map[string]string{files.passwd: passwd, files.group: group} {
		if err := os.WriteFile(path, []byte(content), testFileMode); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}
	calls := &[]chownCall{}
	files.chown = func(path string, uid, gid int) error {
		*calls = append(*calls, chownCall{path: path, uid: uid, gid: gid})
		return nil
	}
	return files, calls
}

func TestEnsureWorkloadUserProvisionsMissingUser(t *testing.T) {
	files, calls := testAccountFiles(t, basePasswd, baseGroup)

	if err := ensureWorkloadUser(testUser, files); err != nil {
		t.Fatalf("ensureWorkloadUser: %v", err)
	}
	users, err := mobyuser.ParsePasswdFile(files.passwd)
	if err != nil {
		t.Fatalf("parse passwd: %v", err)
	}
	var provisioned *mobyuser.User
	for index := range users {
		if users[index].Name == testUser {
			provisioned = &users[index]
		}
	}
	if provisioned == nil || provisioned.Uid != expectedID || provisioned.Gid != expectedID {
		t.Fatalf("provisioned user = %+v, want uid/gid %d", provisioned, expectedID)
	}
	if want := filepath.Join(files.home, testUser); provisioned.Home != want {
		t.Fatalf("home = %q, want %q", provisioned.Home, want)
	}
	if len(*calls) != 1 || (*calls)[0].uid != expectedID {
		t.Fatalf("home ownership calls = %+v", *calls)
	}
	group, err := os.ReadFile(files.group)
	if err != nil {
		t.Fatalf("read group: %v", err)
	}
	if !strings.Contains(string(group), "\nsnapflow:x:1001:\n") {
		t.Fatalf("group file missing private group, unterminated input not handled:\n%s", group)
	}
}

func TestEnsureWorkloadUserKeepsExistingUser(t *testing.T) {
	passwd := basePasswd + "\nsnapflow:x:1000:1000::/home/snapflow:/bin/sh\n"
	files, calls := testAccountFiles(t, passwd, baseGroup)

	if err := ensureWorkloadUser(testUser, files); err != nil {
		t.Fatalf("ensureWorkloadUser: %v", err)
	}
	content, err := os.ReadFile(files.passwd)
	if err != nil {
		t.Fatalf("read passwd: %v", err)
	}
	if string(content) != passwd || len(*calls) != 0 {
		t.Fatal("an existing user was modified")
	}
}

func TestEnsureWorkloadUserLeavesNumericSpecsToTheResolver(t *testing.T) {
	files, calls := testAccountFiles(t, basePasswd, baseGroup)

	if err := ensureWorkloadUser(unrelatedUser, files); err != nil {
		t.Fatalf("ensureWorkloadUser: %v", err)
	}
	content, err := os.ReadFile(files.passwd)
	if err != nil {
		t.Fatalf("read passwd: %v", err)
	}
	if string(content) != basePasswd || len(*calls) != 0 {
		t.Fatal("a numeric user spec created an account")
	}
}
