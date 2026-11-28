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

package vmm

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/hypervisor"
)

type HostAssets struct {
	Firecracker     string
	CloudHypervisor string
}

type Manager struct {
	assets HostAssets
}

func NewManager(assets HostAssets) (Manager, error) {
	normalized, err := assets.normalized()
	if err != nil {
		return Manager{}, err
	}
	return Manager{assets: normalized}, nil
}

func (manager Manager) Resolve(ctx context.Context, selected hypervisor.Hypervisor) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	switch selected {
	case hypervisor.HypervisorFirecracker:
		if err := verifyExecutable(manager.assets.Firecracker); err != nil {
			return "", fmt.Errorf("firecracker executable: %w", err)
		}
		return manager.assets.Firecracker, nil
	case hypervisor.HypervisorCloudHypervisor:
		if err := verifyExecutable(manager.assets.CloudHypervisor); err != nil {
			return "", fmt.Errorf("cloud hypervisor executable: %w", err)
		}
		return manager.assets.CloudHypervisor, nil
	default:
		return "", fmt.Errorf("%w %q", hypervisor.ErrInvalidHypervisor, selected)
	}
}

func (assets HostAssets) normalized() (HostAssets, error) {
	values := []struct {
		name  string
		value *string
	}{
		{name: "Firecracker", value: &assets.Firecracker},
		{name: "Cloud Hypervisor", value: &assets.CloudHypervisor},
	}
	for _, candidate := range values {
		value := filepath.Clean(strings.TrimSpace(*candidate.value))
		if value == "." || !filepath.IsAbs(value) {
			return HostAssets{}, fmt.Errorf("%s path must be absolute", candidate.name)
		}
		*candidate.value = value
	}
	return assets, nil
}

func verifyExecutable(path string) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("path is not a regular file")
	}
	if info.Mode().Perm()&0o111 == 0 {
		return errors.New("path is not executable")
	}
	return nil
}
