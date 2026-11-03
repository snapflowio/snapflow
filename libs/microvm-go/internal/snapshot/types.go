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

package snapshot

import (
	"encoding/json"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
)

type Kind string

const (
	KindStopped Kind = "stopped"
	KindStandby Kind = "standby"
)

type Snapshot struct {
	ID               string                `json:"id"`
	Name             string                `json:"name,omitempty"`
	Kind             Kind                  `json:"kind"`
	SourceInstanceID string                `json:"sourceInstanceId"`
	SourceImage      string                `json:"sourceImage,omitempty"`
	SourceHypervisor hypervisor.Hypervisor `json:"sourceHypervisor"`
	CreatedAt        time.Time             `json:"createdAt"`
	SizeBytes        int64                 `json:"sizeBytes"`
}

type Record struct {
	Snapshot       Snapshot        `json:"snapshot"`
	StoredMetadata json.RawMessage `json:"storedMetadata"`
}
