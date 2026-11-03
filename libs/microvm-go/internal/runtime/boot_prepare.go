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

package runtime

import (
	"context"
	"fmt"

	"github.com/snapflowio/microvm-go/imagecache"
)

type PreparedBootAssets struct {
	KernelPath string
	InitrdPath string
}

func (backend *Backend) PrepareBootAssets(ctx context.Context, platform string) (PreparedBootAssets, error) {
	if err := ctx.Err(); err != nil {
		return PreparedBootAssets{}, err
	}
	resolved, err := imagecache.ResolvePlatform(platform)
	if err != nil {
		return PreparedBootAssets{}, err
	}
	if resolved.Architecture == "" {
		return PreparedBootAssets{}, fmt.Errorf("boot platform architecture is required")
	}
	if err := backend.validateBootPrerequisites(); err != nil {
		return PreparedBootAssets{}, err
	}
	return PreparedBootAssets{KernelPath: backend.kernelPath, InitrdPath: backend.initrdPath}, nil
}
