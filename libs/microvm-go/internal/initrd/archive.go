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

package initrd

import (
	"errors"
	"fmt"
	"io"
)

const initrdEntryMode = 0o755

func WriteArchive(output io.Writer, guestInit []byte) error {
	if len(guestInit) == 0 {
		return errors.New("guest init executable is empty")
	}
	cpio, closeGzip := newCpioGzipWriter(output)
	if err := writeArchive(cpio, guestInit); err != nil {
		return errors.Join(err, closeGzip())
	}
	if err := closeGzip(); err != nil {
		return fmt.Errorf("close initrd gzip stream: %w", err)
	}
	return nil
}

func writeArchive(cpio *cpioWriter, guestInit []byte) error {
	for _, directory := range []string{
		"dev", "dev/pts", "dev/shm", "lower", "mnt", "mnt/config",
		"overlay", "proc", "run", "sys", "tmp",
	} {
		if err := cpio.dir(directory, initrdEntryMode); err != nil {
			return fmt.Errorf("write initrd directory %s: %w", directory, err)
		}
	}
	if err := cpio.file("init", initrdEntryMode, guestInit); err != nil {
		return fmt.Errorf("write initrd init: %w", err)
	}
	if err := cpio.trailer(); err != nil {
		return fmt.Errorf("write initrd trailer: %w", err)
	}
	return nil
}
