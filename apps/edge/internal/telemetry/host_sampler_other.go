// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build !linux

package telemetry

import (
	"fmt"
	"runtime"
)

type HostSampler struct{}

func NewHostSampler() (*HostSampler, error) {
	return &HostSampler{}, nil
}

func (*HostSampler) Sample() (HostSample, error) {
	return HostSample{}, fmt.Errorf("edge host metrics are unsupported on %s", runtime.GOOS)
}
