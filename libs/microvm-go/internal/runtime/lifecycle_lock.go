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

package runtime

import (
	"context"
	"errors"
	"os"

	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
)

func (b *Backend) lockInstanceMutation(ctx context.Context, instanceID string) (*lifecycle.Guard, error) {
	for {
		guard, peerID, err := b.lockInstanceOrFindPeer(ctx, instanceID)
		if err != nil || peerID == "" {
			return guard, err
		}
		pairGuard, err := b.lockLinkedPair(ctx, instanceID, peerID)
		if err != nil || pairGuard != nil {
			return pairGuard, err
		}
	}
}

func (b *Backend) lockInstanceOrFindPeer(ctx context.Context, instanceID string) (*lifecycle.Guard, string, error) {
	guard, err := b.lifecycle.Lock(ctx, instanceID)
	if err != nil {
		return nil, "", err
	}
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if errors.Is(err, os.ErrNotExist) {
		return guard, "", nil
	}
	if err != nil {
		guard.Release()
		return nil, "", err
	}
	if metadata.LinkedPeer == nil {
		return guard, "", nil
	}
	guard.Release()
	return nil, metadata.LinkedPeer.InstanceID, nil
}

func (b *Backend) lockLinkedPair(ctx context.Context, instanceID, peerID string) (*lifecycle.Guard, error) {
	guard, err := b.lifecycle.LockMany(ctx, instanceID, peerID)
	if err != nil {
		return nil, err
	}
	current, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		guard.Release()
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	if current.LinkedPeer != nil && current.LinkedPeer.InstanceID == peerID {
		return guard, nil
	}
	guard.Release()
	return nil, nil
}

func (b *Backend) lockForkMutation(ctx context.Context, sourceID, targetID string) (*lifecycle.Guard, error) {
	return b.lifecycle.LockMany(ctx, sourceID, targetID)
}
