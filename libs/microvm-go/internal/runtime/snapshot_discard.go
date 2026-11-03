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
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/layout"
)

func (b *Backend) discardLatestSnapshot(instanceID string) error {
	latest := b.paths.InstanceLatestSnapshot(instanceID)
	discarded := b.paths.InstanceDiscardedSnapshot(instanceID, strconv.FormatInt(time.Now().UnixNano(), 10))
	if err := os.Rename(latest, discarded); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("retire stopped instance snapshot: %w", err)
	}
	b.background.Go(func() {
		if err := os.RemoveAll(discarded); err != nil {
			slog.Warn("could not remove retired instance snapshot", "instance_id", instanceID, "path", discarded, "error", err)
		}
		b.requestSupportDiskSample()
	})
	return nil
}

func (b *Backend) removeDiscardedSnapshots(instanceID string) error {
	directory := b.paths.InstanceSnapshotsDir(instanceID)
	entries, err := os.ReadDir(directory)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("list instance snapshots: %w", err)
	}
	var removeErrors []error
	for _, entry := range entries {
		if !strings.HasPrefix(entry.Name(), layout.DiscardedSnapshotPrefix) {
			continue
		}
		if err := os.RemoveAll(filepath.Join(directory, entry.Name())); err != nil {
			removeErrors = append(removeErrors, fmt.Errorf("remove retired snapshot %s: %w", entry.Name(), err))
		}
	}
	return errors.Join(removeErrors...)
}
