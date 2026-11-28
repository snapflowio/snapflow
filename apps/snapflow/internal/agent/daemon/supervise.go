// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

var errUnexpectedExit = errors.New("actor exited while its group was running")

type componentExitError struct {
	Component string
	Err       error
}

func (err *componentExitError) Error() string {
	return fmt.Sprintf("%s: %v", err.Component, err.Err)
}

func (err *componentExitError) Unwrap() error { return err.Err }

type stage struct {
	ctx     context.Context
	cancel  context.CancelFunc
	workers sync.WaitGroup
	mu      sync.Mutex
	exit    *componentExitError
}

func newStage(ctx context.Context, cancel context.CancelFunc) *stage {
	return &stage{ctx: ctx, cancel: cancel}
}

func (group *stage) Go(name string, run func(context.Context) error) {
	group.workers.Go(func() {
		group.record(name, run(group.ctx))
	})
}

func (group *stage) start(components componentSet) {
	for _, registered := range components {
		group.Go(registered.name, registered.component.Run)
	}
}

func (group *stage) Done() <-chan struct{} { return group.ctx.Done() }

func (group *stage) Stop() { group.cancel() }

func (group *stage) Wait() error {
	group.workers.Wait()
	group.mu.Lock()
	defer group.mu.Unlock()
	if group.exit == nil {
		return nil
	}
	return group.exit
}

func (group *stage) record(name string, err error) {
	group.mu.Lock()
	if group.exit == nil && group.ctx.Err() == nil {
		if err == nil {
			err = errUnexpectedExit
		}
		group.exit = &componentExitError{Component: name, Err: err}
	}
	group.mu.Unlock()
	group.cancel()
}
