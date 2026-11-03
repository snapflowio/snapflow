// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/snapflowio/common-go/pkg/processlock"
)

const daemonPIDFileMode = 0o600

type MachineLease struct {
	lock        *processlock.Lock
	runtimeRoot string
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
	pidPath := filepath.Join(configuration.RuntimeRoot, DaemonPIDFileName)
	if err := os.WriteFile(pidPath, []byte(strconv.Itoa(os.Getpid())+"\n"), daemonPIDFileMode); err != nil {
		return nil, errors.Join(fmt.Errorf("publish Snapflow process identity: %w", err), lock.Close())
	}
	return &MachineLease{lock: lock, runtimeRoot: configuration.RuntimeRoot}, nil
}

func (lease *MachineLease) Close() error {
	if lease == nil || lease.lock == nil {
		return nil
	}
	removeErr := os.Remove(filepath.Join(lease.runtimeRoot, DaemonPIDFileName))
	if errors.Is(removeErr, os.ErrNotExist) {
		removeErr = nil
	}
	lock := lease.lock
	lease.lock = nil
	return errors.Join(removeErr, lock.Close())
}
