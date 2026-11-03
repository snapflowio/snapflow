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

package builds

import (
	"testing"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/internal/jailidentity"
)

func TestBuilderInstanceIDResolvesJailAndTAPOwner(t *testing.T) {
	instanceID := newBuilderInstanceID()
	if err := uuid.Validate(instanceID); err != nil {
		t.Fatalf("builder instance ID %q is not a guest UUID: %v", instanceID, err)
	}
	owner, group, err := jailidentity.ForInstance(instanceID)
	if err != nil {
		t.Fatalf("resolve builder TAP owner: %v", err)
	}
	if owner == 0 || owner != group {
		t.Fatalf("builder TAP owner = %d:%d, want one unprivileged identity", owner, group)
	}
}
