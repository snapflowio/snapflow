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
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"net/netip"
	"time"

	"github.com/google/uuid"
)

const (
	Version = 1
	ALPN    = "snapflow-tunnel/1"

	MaxBindingRevision = math.MaxInt32

	MaximumControlDocumentClockSkew = 30 * time.Second
)

type Protocol string

const (
	ProtocolHTTP Protocol = "http"
	ProtocolTCP  Protocol = "tcp"
	ProtocolUDP  Protocol = "udp"
)

func (p Protocol) Validate() error {
	switch p {
	case ProtocolHTTP, ProtocolTCP, ProtocolUDP:
		return nil
	default:
		return fmt.Errorf("unsupported protocol %q", p)
	}
}

type ClientHello struct {
	Version                  int       `json:"version"`
	MachineID                uuid.UUID `json:"machineId"`
	MachineSessionGeneration uint32    `json:"machineSessionGeneration"`
	SessionID                uuid.UUID `json:"sessionId"`
	Binding                  Binding   `json:"binding"`
	TLSExporterBinding       string    `json:"tlsExporterBinding"`
}

func (h ClientHello) Validate() error {
	if h.Version != Version {
		return fmt.Errorf("unsupported protocol version %d", h.Version)
	}
	if h.MachineID == uuid.Nil || h.MachineSessionGeneration == 0 {
		return errors.New("machine ID and session generation are required")
	}
	if h.SessionID == uuid.Nil {
		return errors.New("session ID is required")
	}
	if err := h.Binding.Validate(); err != nil {
		return err
	}
	return ValidateTLSExporterBinding(h.TLSExporterBinding)
}

type Binding struct {
	ID       uuid.UUID `json:"id"`
	Revision uint64    `json:"revision"`
	Digest   string    `json:"digest"`
}

func (binding Binding) Validate() error {
	if binding.ID == uuid.Nil {
		return errors.New("binding ID is required")
	}
	if binding.Revision == 0 || binding.Revision > MaxBindingRevision {
		return fmt.Errorf("binding revision must be between 1 and %d", MaxBindingRevision)
	}
	if len(binding.Digest) != hex.EncodedLen(sha256.Size) {
		return errors.New("binding digest must be a SHA-256 hex digest")
	}
	for _, character := range binding.Digest {
		if (character < '0' || character > '9') &&
			(character < 'a' || character > 'f') {
			return errors.New("binding digest must be lowercase hexadecimal")
		}
	}
	return nil
}

type ServerHello struct {
	Version int    `json:"version"`
	EdgeID  string `json:"edgeId"`
}

func (h ServerHello) Validate() error {
	if h.Version != Version {
		return fmt.Errorf("unsupported protocol version %d", h.Version)
	}
	if _, err := uuid.Parse(h.EdgeID); err != nil {
		return fmt.Errorf("invalid edge ID: %w", err)
	}
	return nil
}

type StreamOpen struct {
	Version              int            `json:"version"`
	Binding              Binding        `json:"binding"`
	BackendID            uuid.UUID      `json:"backendId"`
	AssignmentGeneration uint32         `json:"assignmentGeneration"`
	ConnectionID         uuid.UUID      `json:"connectionId"`
	Protocol             Protocol       `json:"protocol"`
	Source               netip.AddrPort `json:"source"`
}

type StreamOpenStatus string

const (
	StreamOpenStatusAccepted          StreamOpenStatus = "accepted"
	StreamOpenStatusBindingMismatch   StreamOpenStatus = "binding_mismatch"
	StreamOpenStatusBackendNotFound   StreamOpenStatus = "backend_not_found"
	StreamOpenStatusMachineDraining   StreamOpenStatus = "machine_draining"
	StreamOpenStatusTargetUnavailable StreamOpenStatus = "target_unavailable"
	StreamOpenStatusTargetCapacity    StreamOpenStatus = "target_capacity"
)

type StreamOpenResult struct {
	Version      int              `json:"version"`
	Status       StreamOpenStatus `json:"status"`
	RetryAfterMS uint32           `json:"retryAfterMs,omitempty"`
}

func (result StreamOpenResult) Validate() error {
	if result.Version != Version {
		return fmt.Errorf("unsupported protocol version %d", result.Version)
	}
	switch result.Status {
	case StreamOpenStatusAccepted,
		StreamOpenStatusBindingMismatch,
		StreamOpenStatusBackendNotFound,
		StreamOpenStatusMachineDraining,
		StreamOpenStatusTargetUnavailable,
		StreamOpenStatusTargetCapacity:
		return nil
	default:
		return fmt.Errorf("unsupported stream open status %q", result.Status)
	}
}

func (o StreamOpen) Validate() error {
	if o.Version != Version {
		return fmt.Errorf("unsupported protocol version %d", o.Version)
	}
	if o.BackendID == uuid.Nil || o.ConnectionID == uuid.Nil {
		return errors.New("backend and connection IDs are required")
	}
	if err := o.Binding.Validate(); err != nil {
		return fmt.Errorf("invalid stream binding: %w", err)
	}
	if o.Protocol != ProtocolHTTP && o.Protocol != ProtocolTCP {
		return errors.New("streams support only HTTP and TCP routes")
	}
	if !o.Source.IsValid() {
		return errors.New("source address is required")
	}
	return nil
}

type HeartbeatRequest struct {
	Version  int    `json:"version"`
	Sequence uint64 `json:"sequence"`
}

func (h HeartbeatRequest) Validate() error {
	if h.Version != Version {
		return fmt.Errorf("unsupported protocol version %d", h.Version)
	}
	if h.Sequence == 0 {
		return errors.New("heartbeat sequence is required")
	}
	return nil
}

type HeartbeatResponse struct {
	Version  int     `json:"version"`
	Sequence uint64  `json:"sequence"`
	Binding  Binding `json:"binding"`
	Draining bool    `json:"draining,omitempty"`
}

func (h HeartbeatResponse) Validate() error {
	if h.Version != Version {
		return fmt.Errorf("unsupported protocol version %d", h.Version)
	}
	if h.Sequence == 0 {
		return errors.New("heartbeat sequence is required")
	}
	return h.Binding.Validate()
}
