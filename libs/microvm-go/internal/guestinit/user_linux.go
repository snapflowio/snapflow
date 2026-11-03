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

//go:build linux

package guestinit

import (
	"fmt"
	"strings"
	"syscall"

	mobyuser "github.com/moby/sys/user"
)

type workloadIdentity struct {
	uid    uint32
	gid    uint32
	groups []uint32
	home   string
}

func resolveWorkloadIdentity(userSpec string) (workloadIdentity, error) {
	spec := strings.TrimSpace(userSpec)
	if spec == "" {
		return workloadIdentity{}, fmt.Errorf("workload OS user is required")
	}
	resolved, err := mobyuser.GetExecUserPath(
		spec,
		&mobyuser.ExecUser{Uid: 0, Gid: 0, Home: "/root"},
		"/etc/passwd",
		"/etc/group",
	)
	if err != nil {
		return workloadIdentity{}, fmt.Errorf("resolve workload OS user %q: %w", spec, err)
	}
	if resolved.Uid < 0 || resolved.Gid < 0 {
		return workloadIdentity{}, fmt.Errorf("workload OS user %q resolved to a negative user or group identifier", spec)
	}
	groups := make([]uint32, 0, len(resolved.Sgids))
	seen := make(map[int]struct{}, len(resolved.Sgids))
	for _, groupID := range resolved.Sgids {
		if groupID < 0 {
			return workloadIdentity{}, fmt.Errorf("workload OS user %q resolved to a negative supplementary group identifier", spec)
		}
		if groupID == resolved.Gid {
			continue
		}
		if _, exists := seen[groupID]; exists {
			continue
		}
		seen[groupID] = struct{}{}
		groups = append(groups, uint32(groupID))
	}
	home := strings.TrimSpace(resolved.Home)
	if home == "" {
		home = "/"
	}
	return workloadIdentity{
		uid:    uint32(resolved.Uid),
		gid:    uint32(resolved.Gid),
		groups: groups,
		home:   home,
	}, nil
}

func workloadProcessAttributes(identity workloadIdentity) *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		Setpgid: true,
		Credential: &syscall.Credential{
			Uid:    identity.uid,
			Gid:    identity.gid,
			Groups: identity.groups,
		},
	}
}

func environmentWithHome(environment []string, home string) []string {
	result := make([]string, 0, len(environment)+1)
	for _, value := range environment {
		if strings.HasPrefix(value, "HOME=") {
			continue
		}
		result = append(result, value)
	}
	return append(result, "HOME="+home)
}
