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

package devices

import (
	"context"
	"fmt"
	"strings"
)

type GPUDevice struct {
	PCIAddress string             `json:"pciAddress"`
	SysfsPath  string             `json:"sysfsPath"`
	Model      string             `json:"model,omitempty"`
	IOMMUGroup int                `json:"iommuGroup"`
	Bindings   []PCIDeviceBinding `json:"bindings,omitempty"`
}

type PCIDeviceBinding struct {
	PCIAddress     string `json:"pciAddress"`
	OriginalDriver string `json:"originalDriver,omitempty"`
}

type GPURequest struct {
	Count  int64
	Model  string
	Commit func([]GPUDevice) error
	Clear  func() error
}

type GPUInventoryDevice struct {
	PCIAddress string
	Model      string
}

type GPUManager interface {
	Assign(ctx context.Context, request GPURequest, excluded map[string]struct{}) ([]GPUDevice, error)
	Release(ctx context.Context, assignments []GPUDevice) error
}

func ErrInsufficientGPU(request GPURequest, available int) error {
	if request.Model == "" {
		return fmt.Errorf("requested %d passthrough GPU device(s), but only %d vfio-ready device(s) are available", request.Count, available)
	}
	return fmt.Errorf("requested %d %q passthrough GPU device(s), but only %d matching vfio-ready device(s) are available", request.Count, request.Model, available)
}

func normalizePCIAddress(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
