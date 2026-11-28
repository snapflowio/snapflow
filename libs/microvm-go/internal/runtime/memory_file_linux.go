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

package runtime

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/internal/state"
	"golang.org/x/sys/unix"
)

const (
	processMapsPathFormat     = "/proc/%d/maps"
	processMapFilesPathFormat = "/proc/%d/map_files/%s"
	processMapsRangeField     = 0
	processMapsDeviceField    = 3
	processMapsInodeField     = 4
	processMapsPathField      = 5
	deletedMappingSuffix      = " (deleted)"
)

type mappedFileIdentity struct {
	device string
	inode  string
}

type mappedFile struct {
	identity     mappedFileIdentity
	addressRange string
}

func vmmMappedMemoryFiles(pid int, memoryFile string) ([]mappedFile, error) {
	data, err := os.ReadFile(fmt.Sprintf(processMapsPathFormat, pid))
	if err != nil {
		return nil, fmt.Errorf("read VMM memory mappings: %w", err)
	}
	var mapped []mappedFile
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) <= processMapsPathField {
			continue
		}
		path := strings.TrimSuffix(strings.Join(fields[processMapsPathField:], " "), deletedMappingSuffix)
		if filepath.Base(path) != memoryFile {
			continue
		}
		mapped = append(mapped, mappedFile{
			identity:     mappedFileIdentity{device: fields[processMapsDeviceField], inode: fields[processMapsInodeField]},
			addressRange: fields[processMapsRangeField],
		})
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan VMM memory mappings: %w", err)
	}
	return mapped, nil
}

func mappedMemoryFile(pid int, memoryFile string) (string, error) {
	mapped, err := vmmMappedMemoryFiles(pid, memoryFile)
	if err != nil {
		return "", err
	}
	if len(mapped) == 0 {
		return "", errMemoryFileNotMapped
	}
	for _, file := range mapped[1:] {
		if file.identity != mapped[0].identity {
			return "", errMemoryFileMappingAmbiguous
		}
	}
	return fmt.Sprintf(processMapFilesPathFormat, pid, mapped[0].addressRange), nil
}

func fileIdentity(path string) (state.FileIdentity, error) {
	var info unix.Stat_t
	if err := unix.Stat(path, &info); err != nil {
		return state.FileIdentity{}, fmt.Errorf("inspect %s: %w", path, err)
	}
	return state.FileIdentity{
		Device:        info.Dev,
		Inode:         info.Ino,
		SizeBytes:     info.Size,
		ModifiedNanos: info.Mtim.Nano(),
	}, nil
}
