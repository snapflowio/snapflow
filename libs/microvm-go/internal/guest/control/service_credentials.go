// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package control

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const serviceCredentialMode = 0o400

var serviceCredentialNamePattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)

func replaceServiceCredentials(root string, previous, next map[string]string) (func() error, error) {
	if strings.TrimSpace(root) == "" || filepath.Clean(root) != root {
		return nil, errors.New("service credential root must be a clean path")
	}
	if err := os.MkdirAll(root, filemode.PrivateDirectory); err != nil {
		return nil, fmt.Errorf("create service credential root: %w", err)
	}
	names := serviceCredentialNames(previous, next)
	for _, name := range names {
		if !serviceCredentialNamePattern.MatchString(name) {
			return nil, fmt.Errorf("invalid service credential name %q", name)
		}
		if token, exists := next[name]; exists && len(strings.TrimSpace(token)) < 32 {
			return nil, fmt.Errorf("service credential %q must contain at least 32 characters", name)
		}
	}

	applied := make([]string, 0, len(names))
	rollback := func() error {
		var rollbackErr error
		for index := len(applied) - 1; index >= 0; index-- {
			name := applied[index]
			rollbackErr = errors.Join(
				rollbackErr,
				writeServiceCredential(root, name, previous[name]),
			)
		}
		return rollbackErr
	}
	for _, name := range names {
		if err := writeServiceCredential(root, name, next[name]); err != nil {
			return nil, errors.Join(
				fmt.Errorf("replace service credential %q: %w", name, err),
				rollback(),
			)
		}
		applied = append(applied, name)
	}
	return rollback, nil
}

func serviceCredentialNames(values ...map[string]string) []string {
	unique := make(map[string]struct{})
	for _, value := range values {
		for name := range value {
			unique[name] = struct{}{}
		}
	}
	names := make([]string, 0, len(unique))
	for name := range unique {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func writeServiceCredential(root, name, token string) error {
	path := filepath.Join(root, name)
	if token == "" {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove credential: %w", err)
		}
		return nil
	}
	if err := atomicfile.Replace(path, []byte(strings.TrimSpace(token)+"\n"), serviceCredentialMode); err != nil {
		return fmt.Errorf("write credential: %w", err)
	}
	if err := atomicfile.Commit(path); err != nil {
		return fmt.Errorf("write credential: %w", err)
	}
	return nil
}
