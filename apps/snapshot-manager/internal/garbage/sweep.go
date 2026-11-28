// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package garbage

import (
	"context"
	"fmt"
	"path"
	"time"

	"github.com/distribution/distribution/v3/registry/storage"
	"github.com/opencontainers/go-digest"
)

type orphan struct {
	blob digest.Digest
	size int64
}

func removeLayerLinks(ctx context.Context, opened store, links []layerLink) (int, error) {
	vacuum := storage.NewVacuum(ctx, opened.driver)
	for index, link := range links {
		if err := ignoreMissing(vacuum.RemoveLayer(link.repository, link.blob)); err != nil {
			return index, fmt.Errorf("remove layer link %s of %s: %w", link.blob, link.repository, err)
		}
	}
	return len(links), nil
}

func sweepBlobs(ctx context.Context, opened store, referenced digestSet, cutoff time.Time) (int, int64, error) {
	orphans, err := findOrphans(ctx, opened, referenced, cutoff)
	if err != nil {
		return 0, 0, err
	}
	vacuum := storage.NewVacuum(ctx, opened.driver)
	freed := int64(0)
	for index, candidate := range orphans {
		if err := ignoreMissing(vacuum.RemoveBlob(candidate.blob.String())); err != nil {
			return index, freed, fmt.Errorf("remove orphaned blob %s: %w", candidate.blob, err)
		}
		freed += candidate.size
	}
	return len(orphans), freed, nil
}

func findOrphans(ctx context.Context, opened store, referenced digestSet, cutoff time.Time) ([]orphan, error) {
	var orphans []orphan
	err := opened.namespace.Blobs().Enumerate(ctx, func(blob digest.Digest) error {
		if referenced.has(blob) {
			return nil
		}
		info, err := opened.driver.Stat(ctx, blobDataPath(blob))
		if ignoreMissing(err) != nil {
			return fmt.Errorf("inspect blob %s: %w", blob, err)
		}
		if err != nil || info.ModTime().After(cutoff) {
			return nil
		}
		orphans = append(orphans, orphan{blob: blob, size: info.Size()})
		return nil
	})
	if err := ignoreMissing(err); err != nil {
		return nil, fmt.Errorf("enumerate registry blobs: %w", err)
	}
	return orphans, nil
}

func blobDataPath(blob digest.Digest) string {
	encoded := blob.Encoded()
	return path.Join(blobsRoot, blob.Algorithm().String(), encoded[:blobShardLength], encoded, blobDataFile)
}
