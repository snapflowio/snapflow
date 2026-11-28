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
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
)

const (
	procStatusPathFormat = "/proc/%d/status"
	caughtSignalsField   = "SigCgt:"
	signalMaskBase       = 16
	signalMaskBits       = 64
)

func catchesSignal(pid int, signal syscall.Signal) (bool, error) {
	data, err := os.ReadFile(fmt.Sprintf(procStatusPathFormat, pid))
	if err != nil {
		return false, err
	}
	for line := range strings.Lines(string(data)) {
		value, found := strings.CutPrefix(line, caughtSignalsField)
		if !found {
			continue
		}
		mask, err := strconv.ParseUint(strings.TrimSpace(value), signalMaskBase, signalMaskBits)
		if err != nil {
			return false, fmt.Errorf("parse caught signals of process %d: %w", pid, err)
		}
		return mask&(uint64(1)<<(uint(signal)-1)) != 0, nil
	}
	return false, fmt.Errorf("process %d status has no caught signal mask", pid)
}
