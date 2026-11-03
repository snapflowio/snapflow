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

package hosttool

import (
	"fmt"
	"strings"
	"syscall"
)

// Failure keeps a full host filesystem that a host tool only reports as text
// detectable with errors.Is(err, syscall.ENOSPC).
func Failure(err error, output string) error {
	output = strings.TrimSpace(output)
	if strings.Contains(strings.ToLower(output), syscall.ENOSPC.Error()) {
		return fmt.Errorf("%w: %w: %s", err, syscall.ENOSPC, output)
	}
	return fmt.Errorf("%w: %s", err, output)
}
