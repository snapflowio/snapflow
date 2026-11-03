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

//go:build !linux

package network

import (
	"context"
	"errors"
	"net"
)

var errNamespacesUnsupported = errors.New("sandbox network namespaces require Linux")

type Manager struct{ config Config }

func NewManager(config Config) *Manager { return &Manager{config: config.Normalized()} }

func (m *Manager) Capacity() int64 { return 0 }

func (m *Manager) Allocate(context.Context, string) (*Allocation, error) {
	if !m.config.Enabled {
		return nil, nil
	}
	return nil, errNamespacesUnsupported
}

func (m *Manager) Release(context.Context, *Allocation) error { return nil }

func (m *Manager) Reconcile(context.Context, map[string]Allocation) error { return nil }

func (m *Manager) Maintain(context.Context) error { return nil }

func (m *Manager) ReadMeter(context.Context, *Allocation) (MeterReading, error) {
	return MeterReading{}, nil
}

func (m *Manager) DialGuest(context.Context, Allocation, string, int) (net.Conn, error) {
	return nil, errNamespacesUnsupported
}

func (m *Manager) SupportsEgressPolicy() bool { return false }

func (m *Manager) ApplyEgressPolicy(_ context.Context, binding PolicyBinding) error {
	if binding.Policy.Constrained() {
		return ErrEgressPolicyUnsupported
	}
	return nil
}

func (m *Manager) RemoveEgressPolicy(context.Context, string) error { return nil }

func (m *Manager) ReconcileEgressPolicies(_ context.Context, bindings []PolicyBinding) error {
	for _, binding := range bindings {
		if binding.Policy.Constrained() {
			return ErrEgressPolicyUnsupported
		}
	}
	return nil
}
