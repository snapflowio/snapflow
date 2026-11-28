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

package hypervisor

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

const procStatStartTimeField = 19

func processStartToken(pid int) (string, error) {
	data, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/stat")
	if err != nil {
		return "", err
	}
	endCommand := strings.LastIndexByte(string(data), ')')
	if endCommand < 0 {
		return "", fmt.Errorf("malformed /proc stat for pid %d", pid)
	}
	fields := strings.Fields(string(data)[endCommand+1:])
	if len(fields) <= procStatStartTimeField {
		return "", fmt.Errorf("incomplete /proc stat for pid %d", pid)
	}
	return fields[procStatStartTimeField], nil
}
