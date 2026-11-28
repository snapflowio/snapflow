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

package hypervisor

import (
	"context"
	"fmt"
	"runtime"
	"strings"

	"github.com/snapflowio/microvm-go/types"
)

type Hypervisor string

const (
	HypervisorFirecracker     Hypervisor = "firecracker"
	HypervisorCloudHypervisor Hypervisor = "cloud_hypervisor"
)

func ParseHypervisor(value string) (Hypervisor, error) {
	switch normalized := Hypervisor(strings.ToLower(strings.TrimSpace(value))); normalized {
	case "":
		return DefaultForHost(), nil
	case HypervisorCloudHypervisor:
		return HypervisorCloudHypervisor, nil
	case HypervisorFirecracker:
		return HypervisorFirecracker, nil
	default:
		return "", fmt.Errorf("%w %q: supported values are %s and %s", ErrInvalidHypervisor, value, HypervisorFirecracker, HypervisorCloudHypervisor)
	}
}

func SupportedHypervisors() []Hypervisor {
	return []Hypervisor{HypervisorFirecracker, HypervisorCloudHypervisor}
}

func DefaultForHost() Hypervisor {
	return HypervisorCloudHypervisor
}

func SupportedOnHost(hv Hypervisor) bool {
	return runtime.GOOS == linuxOS && (hv == HypervisorFirecracker || hv == HypervisorCloudHypervisor)
}

const linuxOS = "linux"

type InstanceProfile string

const (
	InstanceProfileEphemeral InstanceProfile = "ephemeral"
	InstanceProfileService   InstanceProfile = "service"
	InstanceProfileGPU       InstanceProfile = "gpu"
)

const InstanceProfileLabel = "snapflow.io/instance.profile"

func SelectRequested(ctx context.Context, request types.CreateRequest, defaultHypervisor Hypervisor) (Hypervisor, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if strings.TrimSpace(request.Hypervisor) != "" {
		return ParseHypervisor(request.Hypervisor)
	}
	return selectHypervisorForHost(request, defaultHypervisor), nil
}

func selectHypervisorForHost(request types.CreateRequest, defaultHypervisor Hypervisor) Hypervisor {
	if request.GPUQuota > 0 {
		return HypervisorCloudHypervisor
	}

	profile := InstanceProfileForLabels(request.Labels)
	switch profile {
	case InstanceProfileEphemeral:
		return HypervisorFirecracker
	case InstanceProfileService, InstanceProfileGPU:
		return HypervisorCloudHypervisor
	}

	return defaultHypervisor
}

func InstanceProfileForLabels(labels map[string]string) InstanceProfile {
	if len(labels) == 0 {
		return ""
	}
	return InstanceProfile(strings.ToLower(strings.TrimSpace(labels[InstanceProfileLabel])))
}

func APISocketName(hv Hypervisor) string {
	switch hv {
	case HypervisorFirecracker:
		return "fc.sock"
	case HypervisorCloudHypervisor:
		return "ch.sock"
	default:
		return "vm.sock"
	}
}
