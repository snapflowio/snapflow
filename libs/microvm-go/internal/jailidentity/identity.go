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

package jailidentity

import (
	"encoding/binary"
	"fmt"

	"github.com/google/uuid"
)

// Per-instance identities sit above every range a distribution hands to
// users or subordinate id maps (/etc/subuid starts at 100000), so a jailed
// VMM never shares an owner with a host account.
const (
	uidBase  = uint32(1 << 30)
	uidRange = uint32(1 << 30)
)

func ForInstance(instanceID string) (uint32, uint32, error) {
	identifier, err := uuid.Parse(instanceID)
	if err != nil {
		return 0, 0, fmt.Errorf("parse jail identity: %w", err)
	}
	value := binary.BigEndian.Uint32(identifier[:4])
	uid := uidBase + value%uidRange
	return uid, uid, nil
}
