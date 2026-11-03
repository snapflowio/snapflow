// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"fmt"

	"github.com/snapflowio/snapflow/internal/workload"
)

type unavailableError struct {
	ref string
	err error
}

func (failure *unavailableError) Error() string {
	return fmt.Sprintf("snapshot %s is unavailable: %v", failure.ref, failure.err)
}

func (failure *unavailableError) Unwrap() error     { return failure.err }
func (failure *unavailableError) ErrorCode() string { return workload.ErrorCodeSnapshotUnavailable }

type digestMismatchError struct {
	ref      string
	desired  string
	observed string
}

func (failure *digestMismatchError) Error() string {
	return fmt.Sprintf("snapshot %s has digest %s, not the desired %s", failure.ref, failure.observed, failure.desired)
}

func (failure *digestMismatchError) ErrorCode() string {
	return workload.ErrorCodeSnapshotDigestMismatch
}
