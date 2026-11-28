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

package protocol

import (
	"errors"
	"fmt"
	"net/netip"

	"github.com/google/uuid"
)

const MaxServerNameLength = 253

type OriginStreamOpen struct {
	Version      int            `json:"version"`
	ConnectionID uuid.UUID      `json:"connectionId"`
	ServerName   string         `json:"serverName"`
	Source       netip.AddrPort `json:"source"`
	Destination  netip.AddrPort `json:"destination"`
}

func (o OriginStreamOpen) Validate() error {
	if o.Version != Version {
		return fmt.Errorf("unsupported protocol version %d", o.Version)
	}
	if o.ConnectionID == uuid.Nil {
		return errors.New("connection ID is required")
	}
	if o.ServerName == "" || len(o.ServerName) > MaxServerNameLength {
		return fmt.Errorf("server name must have 1-%d characters", MaxServerNameLength)
	}
	if !o.Source.IsValid() || !o.Destination.IsValid() {
		return errors.New("source and destination addresses are required")
	}
	return nil
}
