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

package imagecache

import (
	"context"
	"errors"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const concurrentCallers = 8

const joinGracePeriod = 100 * time.Millisecond

func TestPrepareOnceSharesOneInFlightPreparation(t *testing.T) {
	store := newTestStore(t)
	release := make(chan struct{})
	started := make(chan struct{}, concurrentCallers)
	entered := make(chan struct{}, concurrentCallers)
	var calls atomic.Int32
	var group sync.WaitGroup
	errs := make(chan error, concurrentCallers)
	for range concurrentCallers {
		group.Go(func() {
			entered <- struct{}{}
			record, err := store.prepareOnce(context.Background(), "repository@digest", func(context.Context) (ImageRecord, error) {
				calls.Add(1)
				started <- struct{}{}
				<-release
				return ImageRecord{Digest: testImageDigest}, nil
			})
			if err == nil && record.Digest != testImageDigest {
				err = errors.New("joined preparation returned another record")
			}
			errs <- err
		})
	}
	<-started
	for range concurrentCallers {
		<-entered
	}
	time.Sleep(joinGracePeriod)
	close(release)
	group.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("preparations = %d, want 1", got)
	}
}

func TestPrepareOnceBoundsDistinctPreparations(t *testing.T) {
	store := newTestStore(t)
	release := make(chan struct{})
	started := make(chan struct{}, concurrentCallers)
	var running, peak atomic.Int32
	var group sync.WaitGroup
	for index := range concurrentCallers {
		group.Go(func() {
			if _, err := store.prepareOnce(context.Background(), strconv.Itoa(index), func(context.Context) (ImageRecord, error) {
				current := running.Add(1)
				for {
					previous := peak.Load()
					if current <= previous || peak.CompareAndSwap(previous, current) {
						break
					}
				}
				started <- struct{}{}
				<-release
				running.Add(-1)
				return ImageRecord{}, nil
			}); err != nil {
				t.Error(err)
			}
		})
	}
	for range imagePreparationConcurrency {
		<-started
	}
	close(release)
	group.Wait()
	if got := peak.Load(); got != imagePreparationConcurrency {
		t.Fatalf("peak concurrent preparations = %d, want %d", got, imagePreparationConcurrency)
	}
}

func TestImportImagePreparesTaggedFilesystem(t *testing.T) {
	store := newTestStore(t)
	image := testImage(t, baseLayer(t), whiteoutLayer(t), rootLayer(t))
	record, err := store.ImportImage(context.Background(), "registry.internal/snapflow/flattened:v1", image)
	if err != nil {
		t.Fatal(err)
	}
	if record.Status != ImageStatusReady || record.SizeBytes == 0 {
		t.Fatalf("record = %+v, want a ready filesystem", record)
	}
	cached, err := store.ReadReference("registry.internal/snapflow/flattened:v1")
	if err != nil {
		t.Fatal(err)
	}
	if cached.Digest != record.Digest {
		t.Fatalf("tag resolves to %s, want %s", cached.Digest, record.Digest)
	}
	tree := readErofsTree(t, store.paths.ImageDisk(record.Repository, record.DigestHex()))
	if tree["opaque/new"].content != "new" {
		t.Fatalf("prepared filesystem is missing converted content: %+v", tree["opaque/new"])
	}
	if _, loaded, err := store.LoadImage(record.Reference); err != nil || loaded == nil {
		t.Fatalf("load cached OCI image: %v", err)
	}
}
