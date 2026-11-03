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

package forkvm

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"

	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
)

func copyRegularFilePlain(srcPath, dstPath string, perms fs.FileMode) (retErr error) {
	src, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer func() {
		retErr = errors.Join(retErr, resourcecleanup.Close(src, "fork source file"))
	}()

	dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, perms)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := dst.Close(); retErr == nil && cerr != nil {
			retErr = cerr
		}
		if retErr != nil {
			retErr = errors.Join(
				retErr,
				resourcecleanup.Remove(dstPath, "incomplete fork destination file"),
			)
		}
	}()

	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("copy file contents: %w", err)
	}
	return nil
}
