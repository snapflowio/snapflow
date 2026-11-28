// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"context"
	"sync"
)

func forEachParallel[T any](ctx context.Context, parallelism int, items []T, action func(T)) {
	semaphore := make(chan struct{}, parallelism)
	var group sync.WaitGroup
	defer group.Wait()
	for _, item := range items {
		select {
		case semaphore <- struct{}{}:
		case <-ctx.Done():
			return
		}
		group.Go(func() {
			defer func() { <-semaphore }()
			action(item)
		})
	}
}
