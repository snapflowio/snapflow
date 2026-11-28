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
)

const temporaryPattern = ".%s.*.tmp"

func WriteFile(path string, data []byte, mode os.FileMode) (resultErr error) {
	directory := filepath.Dir(path)
	file, err := os.CreateTemp(directory, fmt.Sprintf(temporaryPattern, filepath.Base(path)))
	if err != nil {
		return fmt.Errorf("create temporary file for %s: %w", path, err)
	}
	temporaryPath := file.Name()
	defer func() {
		if removeErr := os.Remove(temporaryPath); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove temporary file %s: %w", temporaryPath, removeErr))
		}
	}()
	if err := writeAndClose(file, data, mode); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("install %s: %w", path, err)
	}
	return SyncDirectory(directory)
}

func SyncDirectory(path string) error {
	directory, err := os.Open(filepath.Clean(path))
	if err != nil {
		return fmt.Errorf("open directory %s: %w", path, err)
	}
	if err := directory.Sync(); err != nil {
		return errors.Join(fmt.Errorf("sync directory %s: %w", path, err), directory.Close())
	}
	if err := directory.Close(); err != nil {
		return fmt.Errorf("close directory %s: %w", path, err)
	}
	return nil
}

func writeAndClose(file *os.File, data []byte, mode os.FileMode) error {
	if err := file.Chmod(mode); err != nil {
		return errors.Join(err, file.Close())
	}
	if _, err := file.Write(data); err != nil {
		return errors.Join(err, file.Close())
	}
	if err := file.Sync(); err != nil {
		return errors.Join(err, file.Close())
	}
	return file.Close()
}
