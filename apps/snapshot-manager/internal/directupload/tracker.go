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
)

const (
	maximumActiveUploads = 16
	activeUploadsBackoff = time.Minute
)

type uploadTracker struct {
	mu        sync.Mutex
	active    map[string]map[string]time.Time
	verifying map[string]struct{}
}

func newUploadTracker() *uploadTracker {
	return &uploadTracker{active: make(map[string]map[string]time.Time), verifying: make(map[string]struct{})}
}

func (tracker *uploadTracker) reserve(subject, id string, deadline time.Time) bool {
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	tracker.prune(time.Now())
	held := tracker.active[subject]
	if len(held) >= maximumActiveUploads {
		return false
	}
	if held == nil {
		held = make(map[string]time.Time)
		tracker.active[subject] = held
	}
	held[id] = deadline
	return true
}

func (tracker *uploadTracker) release(subject, id string) {
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	delete(tracker.active[subject], id)
	if len(tracker.active[subject]) == 0 {
		delete(tracker.active, subject)
	}
}

func (tracker *uploadTracker) prune(now time.Time) {
	for subject, held := range tracker.active {
		for id, deadline := range held {
			if _, running := tracker.verifying[id]; !running && !deadline.After(now) {
				delete(held, id)
			}
		}
		if len(held) == 0 {
			delete(tracker.active, subject)
		}
	}
}

func (tracker *uploadTracker) startVerifying(id string) bool {
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	if _, running := tracker.verifying[id]; running {
		return false
	}
	tracker.verifying[id] = struct{}{}
	return true
}

func (tracker *uploadTracker) finishVerifying(id string) {
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	delete(tracker.verifying, id)
}

func (tracker *uploadTracker) isVerifying(id string) bool {
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	_, running := tracker.verifying[id]
	return running
}
