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

package processlock

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var ErrHeld = errors.New("process lock is already held")

type Lock struct {
	file *os.File
}

func Acquire(directory, filename string) (*Lock, error) {
	directory = filepath.Clean(strings.TrimSpace(directory))
	filename = strings.TrimSpace(filename)
	if directory == "." || !filepath.IsAbs(directory) {
		return nil, fmt.Errorf("process lock directory must be absolute")
	}
	if filename == "" || filename != filepath.Base(filename) || filename == "." {
		return nil, fmt.Errorf("process lock filename must be a base name")
	}
	return acquire(directory, filename)
}

func (lock *Lock) Close() error {
	if lock == nil || lock.file == nil {
		return nil
	}
	file := lock.file
	lock.file = nil
	return release(file)
}
