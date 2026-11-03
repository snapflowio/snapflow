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

package host

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"

	"github.com/snapflowio/microvm-go/internal/filemode"
)

const reflinkProbeContents = "snapflow-reflink-probe"

func checkReflinkSupport(dataDir string) error {
	return checkReflinkSupportWith(dataDir, func(source, destination *os.File) error {
		return unix.IoctlFileClone(int(destination.Fd()), int(source.Fd()))
	})
}

func checkReflinkSupportWith(dataDir string, clone func(*os.File, *os.File) error) (retErr error) {
	dataDir = strings.TrimSpace(dataDir)
	if dataDir == "" {
		return errors.New("microvm data dir is required")
	}
	if clone == nil {
		return errors.New("reflink clone operation is required")
	}
	probeDir := filepath.Join(dataDir, "system")
	if err := os.MkdirAll(probeDir, filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create template probe directory: %w", err)
	}
	source, err := os.CreateTemp(probeDir, ".template-reflink-source-*")
	if err != nil {
		return fmt.Errorf("create reflink source probe: %w", err)
	}
	sourcePath := source.Name()
	destinationPath := sourcePath + ".clone"
	defer func() {
		retErr = errors.Join(
			retErr,
			removeProbeFile(destinationPath),
			removeProbeFile(sourcePath),
		)
	}()
	if _, err := source.WriteString(reflinkProbeContents); err != nil {
		return errors.Join(fmt.Errorf("write reflink source probe: %w", err), closeProbeFile(source, "source"))
	}
	if err := source.Sync(); err != nil {
		return errors.Join(fmt.Errorf("sync reflink source probe: %w", err), closeProbeFile(source, "source"))
	}
	destination, err := os.OpenFile(destinationPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, filemode.PrivateFile)
	if err != nil {
		return errors.Join(fmt.Errorf("create reflink destination probe: %w", err), closeProbeFile(source, "source"))
	}
	cloneErr := clone(source, destination)
	closeErr := errors.Join(closeProbeFile(destination, "destination"), closeProbeFile(source, "source"))
	if cloneErr != nil {
		return errors.Join(fmt.Errorf("clone probe file: %w", cloneErr), closeErr)
	}
	return closeErr
}

func closeProbeFile(file *os.File, role string) error {
	if err := file.Close(); err != nil {
		return fmt.Errorf("close reflink %s probe: %w", role, err)
	}
	return nil
}

func removeProbeFile(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove reflink probe %s: %w", path, err)
	}
	return nil
}
