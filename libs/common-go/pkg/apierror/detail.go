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

package apierror

import (
	"encoding/json"
	"strings"
)

const (
	maximumDetailLength = 1024
	messageSeparator    = "; "
)

type responseBody struct {
	Message json.RawMessage `json:"message"`
	Error   string          `json:"error"`
}

func detail(body []byte) string {
	if len(body) == 0 {
		return ""
	}
	var response responseBody
	if json.Unmarshal(body, &response) != nil {
		return ""
	}
	message := decodeMessage(response.Message)
	if message == "" {
		message = strings.TrimSpace(response.Error)
	}
	return truncate(message, maximumDetailLength)
}

func decodeMessage(value json.RawMessage) string {
	var message string
	if json.Unmarshal(value, &message) == nil {
		return strings.TrimSpace(message)
	}
	var messages []string
	if json.Unmarshal(value, &messages) == nil {
		return strings.Join(messages, messageSeparator)
	}
	return ""
}

func truncate(value string, maximum int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= maximum {
		return string(runes)
	}
	return string(runes[:maximum])
}
