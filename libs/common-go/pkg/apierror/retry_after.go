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
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	retryAfterBase       = 10
	retryAfterBits       = 64
	maximumRetryAfter    = 24 * time.Hour
	maximumRetrySeconds  = int64(maximumRetryAfter / time.Second)
	unspecifiedRetryWait = time.Duration(0)
)

func ParseRetryAfter(value string, now time.Time) time.Duration {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return unspecifiedRetryWait
	}
	seconds, err := strconv.ParseInt(normalized, retryAfterBase, retryAfterBits)
	if err == nil {
		if seconds < 0 {
			return unspecifiedRetryWait
		}
		return time.Duration(min(seconds, maximumRetrySeconds)) * time.Second
	}
	deadline, err := http.ParseTime(normalized)
	if err != nil || !deadline.After(now) {
		return unspecifiedRetryWait
	}
	return min(deadline.Sub(now), maximumRetryAfter)
}
