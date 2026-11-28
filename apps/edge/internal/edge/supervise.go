// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type drainPlan struct {
	begin        func(context.Context)
	complete     func() bool
	timeout      time.Duration
	pollInterval time.Duration
}

type componentResult struct {
	name string
	err  error
}

func supervise(parent context.Context, components registry, drain drainPlan) error {
	runContext, cancel := context.WithCancel(context.WithoutCancel(parent))
	defer cancel()
	results := make(chan componentResult, len(components))
	for _, registered := range components {
		go func() {
			results <- componentResult{name: registered.name, err: registered.component.Run(runContext)}
		}()
	}

	completed := 0
	var resultErr error
	select {
	case first := <-results:
		completed = 1
		resultErr = componentError(first, nil)
	case <-parent.Done():
		drain.begin(context.WithoutCancel(parent))
		drain.wait()
	}
	cancel()
	for ; completed < len(components); completed++ {
		resultErr = errors.Join(resultErr, componentError(<-results, parent.Err()))
	}
	if parent.Err() != nil {
		return nil
	}
	return resultErr
}

func (drain drainPlan) wait() {
	deadline := time.NewTimer(drain.timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(drain.pollInterval)
	defer ticker.Stop()
	for {
		if drain.complete() {
			return
		}
		select {
		case <-deadline.C:
			return
		case <-ticker.C:
		}
	}
}

func componentError(result componentResult, parentErr error) error {
	if result.err != nil {
		if parentErr != nil && errors.Is(result.err, context.Canceled) {
			return nil
		}
		return fmt.Errorf("%s: %w", result.name, result.err)
	}
	if parentErr == nil {
		return fmt.Errorf("%s stopped unexpectedly", result.name)
	}
	return nil
}
