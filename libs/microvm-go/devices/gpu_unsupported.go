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

//go:build !linux

package devices

import (
	"context"
	"fmt"
	"runtime"
)

type PassthroughGPUManager struct{}

func Init() {}

func NewGPUManager([]GPUInventoryDevice, *GPUQuarantine) GPUManager {
	return PassthroughGPUManager{}
}

func (PassthroughGPUManager) Assign(context.Context, GPURequest, map[string]struct{}) ([]GPUDevice, error) {
	return nil, fmt.Errorf("gpu passthrough is not supported on %s", runtime.GOOS)
}

func (PassthroughGPUManager) Release(context.Context, []GPUDevice) error { return nil }
