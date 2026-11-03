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

package reconnect

import (
	"errors"
	"math/rand/v2"
	"time"
)

const (
	defaultMinimum   = 250 * time.Millisecond
	defaultMaximum   = 30 * time.Second
	defaultFactor    = 2
	defaultJitter    = 0.2
	minimumFactor    = 1
	maximumJitter    = 1
	jitterSpanFactor = 2
)

type Backoff struct {
	Minimum time.Duration
	Maximum time.Duration
	Factor  float64
	Jitter  float64
	attempt int
}

func DefaultBackoff() Backoff {
	return Backoff{
		Minimum: defaultMinimum,
		Maximum: defaultMaximum,
		Factor:  defaultFactor,
		Jitter:  defaultJitter,
	}
}

func (b *Backoff) Validate() error {
	if b.Minimum <= 0 || b.Maximum < b.Minimum || b.Factor < minimumFactor || b.Jitter < 0 || b.Jitter > maximumJitter {
		return errors.New("reconnect backoff requires 0 < minimum <= maximum, factor >= 1 and jitter within [0, 1]")
	}
	return nil
}

func (b *Backoff) Next() time.Duration {
	delay := float64(b.Minimum)
	for range b.attempt {
		delay *= b.Factor
		if delay >= float64(b.Maximum) {
			delay = float64(b.Maximum)
			break
		}
	}
	b.attempt++
	if b.Jitter <= 0 {
		return time.Duration(delay)
	}
	multiplier := 1 - b.Jitter + rand.Float64()*(jitterSpanFactor*b.Jitter)
	return min(time.Duration(delay*multiplier), b.Maximum)
}

func (b *Backoff) Reset() {
	b.attempt = 0
}
