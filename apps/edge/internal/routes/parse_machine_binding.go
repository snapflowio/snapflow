// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"errors"
	"fmt"
	"math"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/protocol"
)

func parseMachineBinding(
	input *apiclient.EdgeMachineBindingDto,
) (MachineBinding, error) {
	bindingRevision := input.BindingRevision
	if bindingRevision < 1 {
		return MachineBinding{}, errors.New("binding revision is invalid")
	}
	binding := protocol.Binding{
		ID:       input.BindingId,
		Revision: uint64(bindingRevision),
		Digest:   input.BindingDigest,
	}
	if err := binding.Validate(); err != nil {
		return MachineBinding{}, fmt.Errorf("invalid binding: %w", err)
	}
	expiresAt := input.LeaseExpiresAt
	if expiresAt.IsZero() {
		return MachineBinding{}, errors.New("binding lease expiry is required")
	}
	sessionGeneration := input.MachineSessionGeneration
	if sessionGeneration < 1 || sessionGeneration > math.MaxUint32 {
		return MachineBinding{}, errors.New("machine session generation is invalid")
	}
	return MachineBinding{
		MachineID:                input.MachineId,
		MachineSessionGeneration: uint32(sessionGeneration),
		Binding:                  binding,
		ExpiresAt:                expiresAt,
	}, nil
}
