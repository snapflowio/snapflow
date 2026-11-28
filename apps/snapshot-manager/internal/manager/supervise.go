// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import (
	"context"
	"errors"
	"fmt"
)

type componentResult struct {
	name string
	err  error
}

func supervise(parent context.Context, components componentSet) error {
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
		resultErr = drain(context.WithoutCancel(parent), components)
	}
	cancel()
	for ; completed < len(components); completed++ {
		resultErr = errors.Join(resultErr, componentError(<-results, parent.Err()))
	}
	return resultErr
}

func drain(ctx context.Context, components componentSet) error {
	var drainErr error
	for _, registered := range components {
		draining, ok := registered.component.(drainer)
		if !ok {
			continue
		}
		if err := draining.Drain(ctx); err != nil {
			drainErr = errors.Join(drainErr, fmt.Errorf("%s: %w", registered.name, err))
		}
	}
	return drainErr
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
