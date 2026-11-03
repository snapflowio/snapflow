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

package ext4

import (
	"errors"
	"os"
	"os/exec"
)

func homebrewSbinPaths() []string {
	return []string{
		"/opt/homebrew/opt/e2fsprogs/sbin",
		"/usr/local/opt/e2fsprogs/sbin",
	}
}

func MkfsPath() (string, error) {
	return executablePath("mkfs.ext4", "mkfs.ext4 was not found; install e2fsprogs to format overlay, config and data disks")
}

func FsckPath() (string, error) {
	return executablePath("e2fsck", "e2fsck was not found; install e2fsprogs to validate recovered volume filesystems")
}

func ResizePath() (string, error) {
	return executablePath("resize2fs", "resize2fs was not found; install e2fsprogs to expand ext4 filesystems")
}

func executablePath(name, unavailableMessage string) (string, error) {
	if path, err := exec.LookPath(name); err == nil {
		return path, nil
	}
	for _, directory := range homebrewSbinPaths() {
		path := directory + "/" + name
		if info, err := os.Stat(path); err == nil && !info.IsDir() && info.Mode()&0o111 != 0 {
			return path, nil
		}
	}
	return "", errors.New(unavailableMessage)
}
