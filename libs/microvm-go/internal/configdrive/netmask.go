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

package configdrive

import (
	"strconv"
	"strings"
)

const (
	ipv4Octets          = 4
	defaultPrefixLength = 24
)

func CIDRFromNetmask(netmask string) int {
	parts := strings.Split(netmask, ".")
	if len(parts) != ipv4Octets {
		return defaultPrefixLength
	}

	bits := 0
	for _, part := range parts {
		value, err := strconv.Atoi(part)
		if err != nil {
			return defaultPrefixLength
		}
		for value > 0 {
			bits += value & 1
			value >>= 1
		}
	}
	return bits
}
