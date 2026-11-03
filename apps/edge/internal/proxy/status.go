// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"sort"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

type Status struct {
	BackendID     uuid.UUID
	Protocol      protocol.Protocol
	PublicPort    uint16
	Listening     bool
	FailureReason string
}

func SortedStatuses(statuses map[uuid.UUID]Status) []Status {
	result := make([]Status, 0, len(statuses))
	for _, status := range statuses {
		result = append(result, status)
	}
	sort.Slice(result, func(left, right int) bool {
		return result[left].BackendID.String() < result[right].BackendID.String()
	})
	return result
}
