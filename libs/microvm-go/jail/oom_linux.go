// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package jail

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	cgroupMountRoot  = "/sys/fs/cgroup"
	memoryEventsFile = "memory.events"
	oomKillEvent     = "oom_kill"
	eventCountBase   = 10
	eventCountBits   = 64
)

type OOMWatch struct {
	events   string
	baseline uint64
}

func WatchOOM(pid int) (OOMWatch, error) {
	cgroup, err := processCgroup(pid)
	if err != nil {
		return OOMWatch{}, err
	}
	events := filepath.Join(cgroupMountRoot, path.Dir(cgroup), memoryEventsFile)
	baseline, err := oomKills(events)
	if err != nil {
		return OOMWatch{}, err
	}
	return OOMWatch{events: events, baseline: baseline}, nil
}

func (watch OOMWatch) Fired() (bool, error) {
	if watch.events == "" {
		return false, nil
	}
	count, err := oomKills(watch.events)
	if err != nil {
		return false, err
	}
	return count > watch.baseline, nil
}

func oomKills(events string) (uint64, error) {
	data, err := os.ReadFile(events)
	if err != nil {
		return 0, fmt.Errorf("read memory events: %w", err)
	}
	for line := range strings.Lines(string(data)) {
		name, value, found := strings.Cut(strings.TrimSpace(line), " ")
		if !found || name != oomKillEvent {
			continue
		}
		count, err := strconv.ParseUint(value, eventCountBase, eventCountBits)
		if err != nil {
			return 0, fmt.Errorf("parse %s count in %s: %w", oomKillEvent, events, err)
		}
		return count, nil
	}
	return 0, fmt.Errorf("%s has no %s count", events, oomKillEvent)
}
