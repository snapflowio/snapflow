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

	"github.com/google/uuid"
)

type Principal string

const (
	PrincipalMachine Principal = "machine"
	PrincipalOrigin  Principal = "origin"
)

type ClientHello struct {
	Version                  int       `json:"version"`
	Principal                Principal `json:"principal,omitempty"`
	OriginSite               string    `json:"originSite,omitempty"`
	MachineID                uuid.UUID `json:"machineId"`
	MachineSessionGeneration uint32    `json:"machineSessionGeneration"`
	SessionID                uuid.UUID `json:"sessionId"`
	Binding                  Binding   `json:"binding"`
	TLSExporterBinding       string    `json:"tlsExporterBinding"`
}

func (h ClientHello) PrincipalKind() Principal {
	if h.Principal == "" {
		return PrincipalMachine
	}
	return h.Principal
}

func (h ClientHello) Validate() error {
	if h.Version != Version {
		return fmt.Errorf("unsupported protocol version %d", h.Version)
	}
	if h.SessionID == uuid.Nil {
		return errors.New("session ID is required")
	}
	if err := h.validatePrincipal(); err != nil {
		return err
	}
	return ValidateTLSExporterBinding(h.TLSExporterBinding)
}

func (h ClientHello) validatePrincipal() error {
	switch h.PrincipalKind() {
	case PrincipalMachine:
		if h.OriginSite != "" {
			return errors.New("machine hello must not name an origin site")
		}
		if h.MachineID == uuid.Nil || h.MachineSessionGeneration == 0 {
			return errors.New("machine ID and session generation are required")
		}
		return h.Binding.Validate()
	case PrincipalOrigin:
		if h.MachineID != uuid.Nil || h.MachineSessionGeneration != 0 || h.Binding != (Binding{}) {
			return errors.New("origin hello must not carry machine fields")
		}
		return ValidateOriginSite(h.OriginSite)
	default:
		return fmt.Errorf("unsupported tunnel principal %q", h.Principal)
	}
}
