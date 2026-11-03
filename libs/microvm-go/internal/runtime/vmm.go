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
	"errors"
	"fmt"
	"net/http"

	"github.com/snapflowio/microvm-go/hypervisor"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
)

type HypervisorBackend interface {
	Capabilities() hypervisor.Capabilities
	Start(context.Context, hypervisor.VM) (hypervisor.Process, error)
	Restore(context.Context, hypervisor.VM, string) (hypervisor.Process, error)
	Pause(context.Context, string) error
	Resume(context.Context, string) error
	Info(context.Context, string) (hypervisor.VMInfo, error)
	Snapshot(context.Context, string, string) error
	Shutdown(context.Context, string) error
	PrepareFork(context.Context, hypervisor.ForkPrepareRequest) (hypervisor.ForkPrepareResult, error)
}

func (b *Backend) hypervisorBackend(hv hypervisor.Hypervisor) (HypervisorBackend, error) {
	backend, found := b.hypervisors[hv]
	if !found {
		return nil, fmt.Errorf("%w %q", hypervisor.ErrInvalidHypervisor, hv)
	}
	return backend, nil
}

func (b *Backend) capabilities(hv hypervisor.Hypervisor) hypervisor.Capabilities {
	backend, found := b.hypervisors[hv]
	if !found {
		return hypervisor.Capabilities{}
	}
	return backend.Capabilities()
}

func (b *Backend) snapshotBackend(hv hypervisor.Hypervisor) (HypervisorBackend, error) {
	backend, err := b.hypervisorBackend(hv)
	if err != nil {
		return nil, err
	}
	if !backend.Capabilities().Snapshots {
		return nil, mvmerrors.New(
			http.StatusNotImplemented,
			fmt.Sprintf("%s snapshots are not available on this host", hv),
			"MICROVM_SNAPSHOT_UNAVAILABLE",
		)
	}
	return backend, nil
}

func restoreSlots(backends map[hypervisor.Hypervisor]HypervisorBackend) map[hypervisor.Hypervisor]chan struct{} {
	slots := make(map[hypervisor.Hypervisor]chan struct{}, len(backends))
	for hv, backend := range backends {
		slots[hv] = make(chan struct{}, max(1, backend.Capabilities().RestoreConcurrency))
	}
	return slots
}

type instanceResourceReleaser interface {
	ReleaseInstance(instanceID string) error
}

type releasedInstanceSweeper interface {
	SweepReleasedInstances() error
}

func (b *Backend) releaseVMMResources(metadata state.InstanceMetadata) error {
	releaser, releases := b.hypervisors[metadata.Hypervisor].(instanceResourceReleaser)
	if !releases {
		return nil
	}
	return releaser.ReleaseInstance(metadata.ID)
}

func (b *Backend) terminateVMM(metadata state.InstanceMetadata, process hypervisor.Process) error {
	if err := hypervisor.Terminate(process, vmmTerminationGracePeriod); err != nil {
		return err
	}
	return b.releaseVMMResources(metadata)
}

func (b *Backend) sweepReleasedVMMResources() error {
	var sweepErrors []error
	for _, backend := range b.hypervisors {
		if sweeper, sweeps := backend.(releasedInstanceSweeper); sweeps {
			sweepErrors = append(sweepErrors, sweeper.SweepReleasedInstances())
		}
	}
	return errors.Join(sweepErrors...)
}
