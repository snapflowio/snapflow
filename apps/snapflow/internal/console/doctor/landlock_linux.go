// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package doctor

import (
	"errors"
	"fmt"

	"golang.org/x/sys/unix"
)

// landlockABIVersion asks the kernel which Landlock ABI it enforces, which
// works even where securityfs (and its lsm list) is not mounted.
func landlockABIVersion() (int, error) {
	abi, _, errno := unix.Syscall(unix.SYS_LANDLOCK_CREATE_RULESET, 0, 0, unix.LANDLOCK_CREATE_RULESET_VERSION)
	switch {
	case errno == 0:
		return int(abi), nil
	case errors.Is(errno, unix.ENOSYS):
		return 0, errors.New("the kernel is built without Landlock")
	case errors.Is(errno, unix.EOPNOTSUPP):
		return 0, errors.New("the kernel has Landlock built in but disabled at boot")
	default:
		return 0, fmt.Errorf("query Landlock ABI: %w", errno)
	}
}
