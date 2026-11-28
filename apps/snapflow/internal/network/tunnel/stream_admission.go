// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"errors"
	"sync"
)

type streamAdmission struct {
	slots chan struct{}
}

type streamPermit struct {
	global  chan struct{}
	session chan struct{}
	once    sync.Once
}

func newStreamAdmission(capacity int) (*streamAdmission, error) {
	if capacity < 1 {
		return nil, errors.New("machine tunnel stream capacity must be positive")
	}
	return &streamAdmission{slots: make(chan struct{}, capacity)}, nil
}

func (admission *streamAdmission) acquire(session chan struct{}) (*streamPermit, bool) {
	if admission == nil || session == nil {
		return nil, false
	}
	select {
	case session <- struct{}{}:
	default:
		return nil, false
	}
	select {
	case admission.slots <- struct{}{}:
		return &streamPermit{global: admission.slots, session: session}, true
	default:
		<-session
		return nil, false
	}
}

func (permit *streamPermit) release() {
	if permit == nil {
		return
	}
	permit.once.Do(func() {
		<-permit.session
		<-permit.global
	})
}
