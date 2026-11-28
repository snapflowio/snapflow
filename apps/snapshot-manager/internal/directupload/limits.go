// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const (
	createsPerMinute   = 120
	completesPerMinute = 120
	statusesPerMinute  = 300
	limiterIdleTimeout = 10 * time.Minute
)

type limits struct {
	create   *subjectLimiter
	complete *subjectLimiter
	status   *subjectLimiter
}

func newLimits() limits {
	return limits{
		create:   newSubjectLimiter(createsPerMinute),
		complete: newSubjectLimiter(completesPerMinute),
		status:   newSubjectLimiter(statusesPerMinute),
	}
}

type limiterEntry struct {
	limiter *rate.Limiter
	seen    time.Time
}

type subjectLimiter struct {
	mu      sync.Mutex
	limit   rate.Limit
	burst   int
	entries map[string]*limiterEntry
	swept   time.Time
}

func newSubjectLimiter(perMinute int) *subjectLimiter {
	return &subjectLimiter{
		limit:   rate.Every(time.Minute / time.Duration(perMinute)),
		burst:   perMinute,
		entries: make(map[string]*limiterEntry),
	}
}

func (limiter *subjectLimiter) wait(subject string) time.Duration {
	now := time.Now()
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	limiter.evictIdle(now)
	entry, found := limiter.entries[subject]
	if !found {
		entry = &limiterEntry{limiter: rate.NewLimiter(limiter.limit, limiter.burst)}
		limiter.entries[subject] = entry
	}
	entry.seen = now
	reservation := entry.limiter.ReserveN(now, 1)
	delay := reservation.DelayFrom(now)
	if delay > 0 {
		reservation.CancelAt(now)
	}
	return delay
}

func (limiter *subjectLimiter) evictIdle(now time.Time) {
	if now.Sub(limiter.swept) < limiterIdleTimeout {
		return
	}
	limiter.swept = now
	for subject, entry := range limiter.entries {
		if now.Sub(entry.seen) >= limiterIdleTimeout {
			delete(limiter.entries, subject)
		}
	}
}
