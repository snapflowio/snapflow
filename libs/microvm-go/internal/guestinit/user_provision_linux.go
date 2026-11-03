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
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"

	mobyuser "github.com/moby/sys/user"
)

const (
	firstRegularID  = 1000
	lastRegularID   = 60000
	accountFileMode = 0o644
	homeMode        = 0o750
	homeRoot        = "/home"
	bashShell       = "/bin/bash"
	posixShell      = "/bin/sh"
)

var accountNamePattern = regexp.MustCompile(`^[a-z_][a-z0-9_-]{0,31}$`)

type accountFiles struct {
	passwd string
	group  string
	home   string
	chown  func(path string, uid, gid int) error
}

func systemAccountFiles() accountFiles {
	return accountFiles{
		passwd: "/etc/passwd",
		group:  "/etc/group",
		home:   homeRoot,
		chown:  os.Chown,
	}
}

func ensureWorkloadUser(name string, files accountFiles) error {
	if !accountNamePattern.MatchString(name) {
		return nil
	}
	users, err := mobyuser.ParsePasswdFile(files.passwd)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("read %s: %w", files.passwd, err)
	}
	for _, user := range users {
		if user.Name == name {
			return nil
		}
	}
	groups, err := mobyuser.ParseGroupFile(files.group)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("read %s: %w", files.group, err)
	}
	id, err := firstFreeID(users, groups)
	if err != nil {
		return err
	}
	home := filepath.Join(files.home, name)
	if err := appendLine(files.group, fmt.Sprintf("%s:x:%d:", name, id)); err != nil {
		return err
	}
	passwdLine := fmt.Sprintf("%s:x:%d:%d::%s:%s", name, id, id, home, loginShell())
	if err := appendLine(files.passwd, passwdLine); err != nil {
		return err
	}
	if err := os.MkdirAll(home, homeMode); err != nil {
		return fmt.Errorf("create home for %s: %w", name, err)
	}
	if err := files.chown(home, id, id); err != nil {
		return fmt.Errorf("assign home of %s: %w", name, err)
	}
	Log("provisioned workload user %s uid=%d", name, id)
	return nil
}

func firstFreeID(users []mobyuser.User, groups []mobyuser.Group) (int, error) {
	taken := make(map[int]struct{}, len(users)+len(groups))
	for _, user := range users {
		taken[user.Uid] = struct{}{}
	}
	for _, group := range groups {
		taken[group.Gid] = struct{}{}
	}
	for id := firstRegularID; id <= lastRegularID; id++ {
		if _, used := taken[id]; !used {
			return id, nil
		}
	}
	return 0, errors.New("no free user identifier for the workload user")
}

func loginShell() string {
	if _, err := os.Stat(bashShell); err == nil {
		return bashShell
	}
	return posixShell
}

func appendLine(path, line string) (resultErr error) {
	existing, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("read %s: %w", path, err)
	}
	if len(existing) > 0 && existing[len(existing)-1] != '\n' {
		line = "\n" + line
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND|os.O_CREATE, accountFileMode)
	if err != nil {
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close %s: %w", path, closeErr))
		}
	}()
	if _, err := fmt.Fprintln(file, line); err != nil {
		return fmt.Errorf("append to %s: %w", path, err)
	}
	return nil
}
