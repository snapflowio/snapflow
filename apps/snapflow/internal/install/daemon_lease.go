// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"fmt"

	"github.com/snapflowio/common-go/pkg/processlock"
)

type MachineLease struct {
	lock *processlock.Lock
}

func AcquireMachineLease(runtimeRoot string) (*MachineLease, error) {
	configuration, err := (Config{
		InstallationRoot: "/unused",
		StateRoot:        "/unused",
		RuntimeRoot:      runtimeRoot,
	}).validate()
	if err != nil {
		return nil, err
	}
	lock, err := processlock.Acquire(configuration.RuntimeRoot, DaemonLockName)
	if err != nil {
		return nil, fmt.Errorf("acquire Snapflow process lease: %w", err)
	}
	return &MachineLease{lock: lock}, nil
}

func (lease *MachineLease) Close() error {
	if lease == nil || lease.lock == nil {
		return nil
	}
	lock := lease.lock
	lease.lock = nil
	return lock.Close()
}
