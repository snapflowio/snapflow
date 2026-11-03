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

package atomicfile

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
)

const temporaryPattern = ".snapflow-atomic-*"

func Replace(path string, data []byte, mode os.FileMode) (returnErr error) {
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create destination directory: %w", err)
	}
	temporary, err := os.CreateTemp(directory, temporaryPattern)
	if err != nil {
		return fmt.Errorf("create temporary file: %w", err)
	}
	temporaryPath := temporary.Name()
	temporaryOpen := true
	installed := false
	defer func() {
		if temporaryOpen {
			returnErr = errors.Join(returnErr, resourcecleanup.Close(temporary, "temporary atomic file"))
		}
		if !installed {
			returnErr = errors.Join(returnErr, resourcecleanup.Remove(temporaryPath, "temporary atomic file"))
		}
	}()
	if _, err := temporary.Write(data); err != nil {
		return fmt.Errorf("write temporary file: %w", err)
	}
	if err := temporary.Chmod(mode); err != nil {
		return fmt.Errorf("set temporary file permissions: %w", err)
	}
	temporaryOpen = false
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close temporary file: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("replace destination file: %w", err)
	}
	installed = true
	return nil
}

func Commit(paths ...string) error {
	groups, err := groupByFilesystem(paths)
	if err != nil {
		return err
	}
	var syncErrors []error
	for _, group := range groups {
		if len(group) == 1 {
			syncErrors = append(syncErrors, syncPath(group[0]), syncPath(filepath.Dir(group[0])))
			continue
		}
		syncErrors = append(syncErrors, syncFilesystem(filepath.Dir(group[0])))
	}
	return errors.Join(syncErrors...)
}

func syncPath(path string) (returnErr error) {
	handle, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open %s for sync: %w", path, err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(handle, path))
	}()
	if err := handle.Sync(); err != nil {
		return fmt.Errorf("sync %s: %w", path, err)
	}
	return nil
}
