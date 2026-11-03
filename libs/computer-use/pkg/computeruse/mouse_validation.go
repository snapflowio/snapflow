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

package computeruse

import (
	"fmt"
	"strings"
)

const (
	defaultMouseButton  = "left"
	middleMouseButton   = "middle"
	defaultScrollAmount = 1
	scrollDirectionUp   = "up"
	scrollDirectionDown = "down"
)

func normalizeMouseButton(button string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(button))
	if normalized == "" {
		return defaultMouseButton, nil
	}

	switch normalized {
	case defaultMouseButton, "right", middleMouseButton:
		return normalized, nil
	default:
		return "", fmt.Errorf("unsupported mouse button %q: expected one of left, right, middle", button)
	}
}

func robotgoMouseButton(canonical string) string {
	if canonical == middleMouseButton {
		return "center"
	}
	return canonical
}

func normalizeScrollDirection(direction string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(direction))

	switch normalized {
	case scrollDirectionUp, scrollDirectionDown:
		return normalized, nil
	default:
		return "", fmt.Errorf("unsupported scroll direction %q: expected up or down", direction)
	}
}

func normalizeScrollAmount(amount int) (int, error) {
	if amount < 0 {
		return 0, fmt.Errorf("scroll amount must be greater than or equal to 0")
	}

	if amount == 0 {
		return defaultScrollAmount, nil
	}

	return amount, nil
}
