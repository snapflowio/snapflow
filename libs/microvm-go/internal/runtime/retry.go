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

package runtime

import (
	"context"
	"errors"
	"time"

	"github.com/cenkalti/backoff/v5"
)

const (
	guestPollFastWindow   = time.Second
	guestPollFastInterval = 2 * time.Millisecond
	guestPollSlowInterval = 25 * time.Millisecond
)

type guestPollSchedule struct {
	startedAt time.Time
}

func newGuestPollSchedule() *guestPollSchedule {
	return &guestPollSchedule{startedAt: time.Now()}
}

func (s *guestPollSchedule) NextBackOff() time.Duration {
	if time.Since(s.startedAt) < guestPollFastWindow {
		return guestPollFastInterval
	}
	return guestPollSlowInterval
}

func (s *guestPollSchedule) Reset() {
	s.startedAt = time.Now()
}

func retryGuestOperation(
	ctx context.Context,
	operation func() error,
	retryable func(error) bool,
) error {
	lastError, retryError := backoff.Retry(
		ctx,
		func() (error, error) {
			operationError := operation()
			if operationError == nil {
				return nil, nil
			}
			if !retryable(operationError) {
				return operationError, backoff.Permanent(operationError)
			}
			return operationError, operationError
		},
		backoff.WithBackOff(newGuestPollSchedule()),
		backoff.WithMaxElapsedTime(0),
	)
	if retryError == nil {
		return nil
	}
	if lastError == nil || errors.Is(retryError, lastError) {
		return retryError
	}
	return errors.Join(retryError, lastError)
}

func retryEveryError(err error) bool {
	return err != nil
}
