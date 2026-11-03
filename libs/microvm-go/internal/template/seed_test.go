// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package template

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const (
	preparingTemplateKey = "preparing-key"
	seedWaitTimeout      = 5 * time.Second
)

var errSeedReleased = errors.New("seed build released by the test")

type blockingSeeds struct {
	builds    atomic.Int32
	started   chan struct{}
	release   chan struct{}
	destroyed chan struct{}
}

func (seeds *blockingSeeds) BuildSeed(context.Context, types.CreateRequest) error {
	seeds.builds.Add(1)
	seeds.started <- struct{}{}
	<-seeds.release
	return errSeedReleased
}

func (seeds *blockingSeeds) DestroySeed(context.Context, string) error {
	seeds.destroyed <- struct{}{}
	return nil
}

func TestPreparedSeedStartsTheSeedInTheBackgroundWithoutWaiting(t *testing.T) {
	seeds := &blockingSeeds{started: make(chan struct{}, 1), release: make(chan struct{}), destroyed: make(chan struct{}, 1)}
	cache := New(Config{Paths: layout.NewPaths(t.TempDir())}, seeds)
	request := types.CreateRequest{ID: SeedID(preparingTemplateKey)}

	if _, err := cache.PreparedSeed(t.Context(), preparingTemplateKey, Key{}, request); !errors.Is(err, ErrPreparing) {
		t.Fatalf("PreparedSeed() error = %v, want ErrPreparing", err)
	}
	awaitSignal(t, seeds.started, "the seed build did not start")
	if _, err := cache.PreparedSeed(t.Context(), preparingTemplateKey, Key{}, request); !errors.Is(err, ErrPreparing) {
		t.Fatalf("PreparedSeed() during the build error = %v, want ErrPreparing", err)
	}
	close(seeds.release)
	awaitSignal(t, seeds.destroyed, "the failed seed was not cleaned up")
	if builds := seeds.builds.Load(); builds != 1 {
		t.Fatalf("seed builds = %d, want one shared build", builds)
	}
}

func awaitSignal(t *testing.T, signal <-chan struct{}, failure string) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(seedWaitTimeout):
		t.Fatal(failure)
	}
}
