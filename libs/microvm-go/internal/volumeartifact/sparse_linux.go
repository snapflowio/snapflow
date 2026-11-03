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

package volumeartifact

import (
	"errors"
	"fmt"
	"os"

	"golang.org/x/sys/unix"
)

// forEachDataBlock visits, in increasing order, every block that overlaps an
// allocated region of file so holes are never read.
func forEachDataBlock(file *os.File, sizeBytes int64, visit func(index int64) error) error {
	for offset := int64(0); offset < sizeBytes; {
		dataStart, err := file.Seek(offset, unix.SEEK_DATA)
		if errors.Is(err, unix.ENXIO) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("seek to volume data: %w", err)
		}
		dataEnd, err := file.Seek(dataStart, unix.SEEK_HOLE)
		if err != nil {
			return fmt.Errorf("seek to volume hole: %w", err)
		}
		last := (min(dataEnd, sizeBytes) - 1) / BlockSize
		for index := dataStart / BlockSize; index <= last; index++ {
			if err := visit(index); err != nil {
				return err
			}
		}
		offset = (last + 1) * BlockSize
	}
	return nil
}
