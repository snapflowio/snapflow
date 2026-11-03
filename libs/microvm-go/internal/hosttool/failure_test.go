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

package hosttool

import (
	"errors"
	"strings"
	"syscall"
	"testing"
)

func TestFailureAttributesAFullHostFilesystemToENOSPC(t *testing.T) {
	exitErr := errors.New("exit status 1")
	err := Failure(exitErr, "mkfs.ext4: No space left on device while writing out and closing file system\n")
	if !errors.Is(err, syscall.ENOSPC) || !errors.Is(err, exitErr) {
		t.Fatalf("Failure() = %v, want ENOSPC and the exit error in the chain", err)
	}
}

func TestFailureKeepsOtherToolOutputAsText(t *testing.T) {
	exitErr := errors.New("exit status 8")
	err := Failure(exitErr, "resize2fs: Bad magic number in super-block\n")
	if errors.Is(err, syscall.ENOSPC) || !errors.Is(err, exitErr) {
		t.Fatalf("Failure() = %v, want only the exit error in the chain", err)
	}
	if !strings.HasSuffix(err.Error(), "Bad magic number in super-block") {
		t.Fatalf("Failure() = %q, want the trimmed tool output", err)
	}
}
