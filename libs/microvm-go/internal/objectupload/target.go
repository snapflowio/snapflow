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

package objectupload

import (
	"errors"
	"fmt"
	"time"
)

const (
	bytesPerMiB          = int64(1024 * 1024)
	minimumPartSizeBytes = 64 * bytesPerMiB
	plannedPartCount     = int64(9000)
	maximumPartCount     = int64(10000)
)

var ErrCredentialExpired = errors.New("object upload credential has expired")

type Target struct {
	Endpoint        string
	Region          string
	Bucket          string
	Key             string
	ContentType     string
	AccessKeyID     string
	SecretAccessKey string
	SessionToken    string
	ExpiresAt       time.Time
	PartSizeBytes   int64
}

func (target Target) validate(now time.Time) error {
	if !now.Before(target.ExpiresAt) {
		return ErrCredentialExpired
	}
	if target.Bucket == "" || target.Key == "" {
		return errors.New("object upload target needs a bucket and a key")
	}
	if target.AccessKeyID == "" || target.SecretAccessKey == "" {
		return errors.New("object upload target needs a credential")
	}
	return nil
}

func (target Target) partSize(sizeBytes int64) (int64, error) {
	partSize := target.PartSizeBytes
	if partSize <= 0 {
		partSize = roundUp(max(minimumPartSizeBytes, ceilDiv(sizeBytes, plannedPartCount)), bytesPerMiB)
	}
	if ceilDiv(sizeBytes, partSize) > maximumPartCount {
		return 0, fmt.Errorf("%d bytes in %d byte parts exceeds %d parts", sizeBytes, partSize, maximumPartCount)
	}
	return partSize, nil
}

func ceilDiv(value, divisor int64) int64 {
	return (value + divisor - 1) / divisor
}

func roundUp(value, multiple int64) int64 {
	return ceilDiv(value, multiple) * multiple
}
