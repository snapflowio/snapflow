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

package volumes

import (
	"context"
	"errors"
	"fmt"
	"os/exec"

	"github.com/snapflowio/microvm-go/ext4"
	"github.com/snapflowio/microvm-go/internal/hosttool"
)

func resizeExt4(ctx context.Context, device string) error {
	fsckPath, err := ext4.FsckPath()
	if err != nil {
		return err
	}
	fsckOutput, fsckErr := exec.CommandContext(ctx, fsckPath, "-f", "-p", device).CombinedOutput()
	if fsckErr != nil {
		var exitError *exec.ExitError
		if !errors.As(fsckErr, &exitError) || exitError.ExitCode() > 1 {
			return fmt.Errorf("check volume filesystem before growth: %w", hosttool.Failure(fsckErr, string(fsckOutput)))
		}
	}
	resizePath, err := ext4.ResizePath()
	if err != nil {
		return err
	}
	resizeOutput, err := exec.CommandContext(ctx, resizePath, device).CombinedOutput()
	if err != nil {
		return fmt.Errorf("grow volume filesystem: %w", hosttool.Failure(err, string(resizeOutput)))
	}
	return nil
}
