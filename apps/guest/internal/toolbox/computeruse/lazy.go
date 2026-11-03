// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package computeruse

import (
	"context"
	"fmt"
	"sync"

	"github.com/snapflowio/computer-use/plugin"
)

type LazyComputerUse struct {
	mu             sync.RWMutex
	impl           plugin.ComputerUse
	availability   Availability
	unavailableErr error
	settled        chan struct{}
	settleOnce     sync.Once
}

func NewLazyComputerUse() *LazyComputerUse {
	return &LazyComputerUse{
		availability:   AvailabilityLoading,
		unavailableErr: errNotLoaded,
		settled:        make(chan struct{}),
	}
}

func (l *LazyComputerUse) Set(impl plugin.ComputerUse) {
	l.setAvailability(impl, AvailabilityReady, nil)
}

func (l *LazyComputerUse) MarkUnavailable() {
	l.setAvailability(nil, AvailabilityUnavailable, ErrUnavailable)
}

func (l *LazyComputerUse) MarkFailed(cause error) {
	l.setAvailability(nil, AvailabilityFailed, fmt.Errorf("%w: %w", errLoadFailed, cause))
}

func (l *LazyComputerUse) Availability() Availability {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.availability
}

func (l *LazyComputerUse) state() (Availability, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.availability, l.unavailableErr
}

func (l *LazyComputerUse) setAvailability(impl plugin.ComputerUse, availability Availability, unavailableErr error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.impl = impl
	l.availability = availability
	l.unavailableErr = unavailableErr
	l.settleOnce.Do(func() { close(l.settled) })
}

func (l *LazyComputerUse) waitSettled(ctx context.Context) {
	select {
	case <-l.settled:
	case <-ctx.Done():
	}
}

func (l *LazyComputerUse) Current() (plugin.ComputerUse, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.impl == nil {
		return nil, l.unavailableErr
	}
	return l.impl, nil
}

func (l *LazyComputerUse) GetStatus() (*plugin.ComputerUseStatusResponse, error) {
	l.mu.RLock()
	impl, availability := l.impl, l.availability
	l.mu.RUnlock()
	if impl == nil {
		return &plugin.ComputerUseStatusResponse{Status: string(availability)}, nil
	}
	return impl.GetStatus()
}

func Call[Response any](l *LazyComputerUse, operation func(plugin.ComputerUse) (*Response, error)) func() (*Response, error) {
	return func() (*Response, error) {
		impl, err := l.Current()
		if err != nil {
			return nil, err
		}
		return operation(impl)
	}
}

func CallWith[Request, Response any](l *LazyComputerUse, operation func(plugin.ComputerUse, *Request) (*Response, error)) func(*Request) (*Response, error) {
	return func(request *Request) (*Response, error) {
		impl, err := l.Current()
		if err != nil {
			return nil, err
		}
		return operation(impl, request)
	}
}
