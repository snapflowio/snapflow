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
	"fmt"
	"log/slog"

	"github.com/snapflowio/microvm-go/imagecache"
)

func (b *Backend) releaseStalePlatformBundles(ctx context.Context, current []imagecache.ImageRecord) error {
	keep := make(map[string]map[string]bool)
	for _, record := range current {
		if keep[record.Repository] == nil {
			keep[record.Repository] = make(map[string]bool)
		}
		keep[record.Repository][record.Digest] = true
	}
	protected, err := b.protectedImageDirs()
	if err != nil {
		return fmt.Errorf("find platform bundles held by runtimes: %w", err)
	}
	for repository, digests := range keep {
		released, err := b.images.ReleaseDiskArtifacts(ctx, repository, digests, protected)
		if err != nil {
			return fmt.Errorf("release stale platform bundles of %s: %w", repository, err)
		}
		if released > 0 {
			slog.InfoContext(ctx, "stale platform bundles released", "repository", repository, "released", released)
		}
	}
	return nil
}
