// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	maximumInterval          = 10 * time.Minute
	maximumCheckpointSamples = 10_000
	maximumCounter           = uint64(math.MaxInt64)
)

type usageInterval struct {
	EdgeSessionGeneration int32                          `json:"edgeSessionGeneration"`
	IntervalStartedAt     time.Time                      `json:"intervalStartedAt"`
	IntervalEndedAt       time.Time                      `json:"intervalEndedAt"`
	Samples               []apiclient.EdgeUsageSampleDto `json:"samples"`
}

func (interval usageInterval) validate() error {
	if interval.EdgeSessionGeneration < 1 {
		return errors.New("edge usage session generation is invalid")
	}
	if !interval.IntervalEndedAt.After(interval.IntervalStartedAt) ||
		interval.IntervalEndedAt.Sub(interval.IntervalStartedAt) > maximumInterval {
		return errors.New("edge usage interval duration is invalid")
	}
	if len(interval.Samples) == 0 || len(interval.Samples) > maximumCheckpointSamples {
		return errors.New("edge usage interval sample count is invalid")
	}
	seenBackends := make(map[uuid.UUID]struct{}, len(interval.Samples))
	for index, sample := range interval.Samples {
		if err := validateSample(sample); err != nil {
			return fmt.Errorf("validate Edge usage sample %d: %w", index, err)
		}
		if _, exists := seenBackends[sample.BackendId]; exists {
			return fmt.Errorf("duplicate Edge usage backend %s", sample.BackendId)
		}
		seenBackends[sample.BackendId] = struct{}{}
	}
	return nil
}

func canonicalTime(value time.Time) time.Time {
	return value.UTC().Truncate(time.Millisecond)
}

func addCounter(current, increment uint64) uint64 {
	if current >= maximumCounter || increment > maximumCounter-current {
		return maximumCounter
	}
	return current + increment
}
