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
	"net/http"
	"os"
	"strings"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/guestmemory"
	"github.com/snapflowio/microvm-go/hypervisor"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
	"golang.org/x/sync/errgroup"
)

type bootAssets struct {
	hypervisorBinary string
	kernelPath       string
	initrdPath       string
}

func (b *Backend) validateBootPrerequisites() error {
	if err := validateReadableBootAsset("kernel", b.kernelPath); err != nil {
		return err
	}
	if err := validateReadableBootAsset("initrd", b.initrdPath); err != nil {
		return err
	}
	return nil
}

func validateReadableBootAsset(label, path string) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return mvmerrors.New(
			http.StatusNotImplemented,
			"microVM "+label+" path is not configured",
			"MICROVM_BOOT_ASSET_UNAVAILABLE",
		)
	}
	info, err := os.Stat(path)
	if err != nil {
		return mvmerrors.New(
			http.StatusFailedDependency,
			fmt.Sprintf("microVM %s is not readable: %v", label, err),
			"MICROVM_BOOT_ASSET_UNAVAILABLE",
		)
	}
	if info.IsDir() {
		return mvmerrors.New(
			http.StatusFailedDependency,
			"microVM "+label+" path points to a directory",
			"MICROVM_BOOT_ASSET_UNAVAILABLE",
		)
	}
	return nil
}

func (b *Backend) resolveBootAssets(ctx context.Context, hv hypervisor.Hypervisor) (bootAssets, error) {
	assets := bootAssets{}
	group, groupCtx := errgroup.WithContext(ctx)
	group.Go(func() error {
		path, err := b.hypervisorBinary(groupCtx, hv)
		assets.hypervisorBinary = path
		return err
	})
	group.Go(func() error {
		assets.kernelPath = b.kernelPath
		return validateReadableBootAsset("kernel", assets.kernelPath)
	})
	group.Go(func() error {
		assets.initrdPath = b.initrdPath
		return validateReadableBootAsset("initrd", assets.initrdPath)
	})
	if err := group.Wait(); err != nil {
		return bootAssets{}, err
	}
	return assets, nil
}

func (b *Backend) kernelArgsWithPolicy(metadata state.InstanceMetadata, bootPolicy instanceBootPolicy) string {
	args := []string{
		"reboot=k",
		"panic=1",
		"root=/dev/vda",
		"rootfstype=" + string(guest.FilesystemEROFS),
		"rootflags=ro",
		"snapflow.config=/dev/vdc",
	}
	capabilities := b.capabilities(metadata.Hypervisor)
	if bootPolicy.serialConsole {
		args = append([]string{"console=" + capabilities.SerialConsole}, args...)
	} else if capabilities.DisableLegacySerial {
		args = append(args, "8250.nr_uarts=0")
	}
	return guestmemory.MergeKernelArgs(
		strings.Join(args, " "),
		strings.Join(bootPolicy.memory.KernelArgs(), " "),
	)
}
