// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"runtime"
	"sync/atomic"

	"golang.org/x/sync/errgroup"
)

type blockWorker func(index uint64) error

func forEachBlock(ctx context.Context, blocks uint64, newWorker func() blockWorker) error {
	group, groupContext := errgroup.WithContext(ctx)
	var next atomic.Uint64
	for range runtime.GOMAXPROCS(0) {
		work := newWorker()
		group.Go(func() error {
			for groupContext.Err() == nil {
				index := next.Add(1) - 1
				if index >= blocks {
					return nil
				}
				if err := work(index); err != nil {
					return err
				}
			}
			return groupContext.Err()
		})
	}
	return group.Wait()
}

func shared(work blockWorker) func() blockWorker {
	return func() blockWorker { return work }
}
