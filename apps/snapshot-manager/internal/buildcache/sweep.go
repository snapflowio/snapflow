// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package buildcache

import (
	"context"
	"errors"
	"fmt"

	"github.com/distribution/distribution/v3"
	"github.com/distribution/distribution/v3/registry/storage"
	storagedriver "github.com/distribution/distribution/v3/registry/storage/driver"
	"github.com/opencontainers/go-digest"
)

func sweepOrphanBlobs(ctx context.Context, opened store) (int, error) {
	referenced, err := referencedBlobs(ctx, opened.registry)
	if err != nil {
		return 0, err
	}
	var orphans []digest.Digest
	err = opened.registry.Blobs().Enumerate(ctx, func(blob digest.Digest) error {
		if _, linked := referenced[blob]; !linked {
			orphans = append(orphans, blob)
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("enumerate registry blobs: %w", err)
	}
	vacuum := storage.NewVacuum(ctx, opened.driver)
	for index, orphan := range orphans {
		if err := vacuum.RemoveBlob(orphan.String()); err != nil {
			return index, fmt.Errorf("remove orphaned blob %s: %w", orphan, err)
		}
	}
	return len(orphans), nil
}

type blobSet map[digest.Digest]struct{}

func (set blobSet) mark(blob digest.Digest) error {
	set[blob] = struct{}{}
	return nil
}

func referencedBlobs(ctx context.Context, namespace distribution.Namespace) (blobSet, error) {
	enumerator, ok := namespace.(distribution.RepositoryEnumerator)
	if !ok {
		return nil, errors.New("registry storage cannot enumerate repositories")
	}
	referenced := make(blobSet)
	err := enumerator.Enumerate(ctx, func(name string) error {
		repository, err := openRepository(ctx, namespace, name)
		if err != nil {
			return err
		}
		return markRepository(ctx, repository, name, referenced)
	})
	if err != nil {
		return nil, fmt.Errorf("mark referenced blobs: %w", err)
	}
	return referenced, nil
}

func markRepository(ctx context.Context, repository distribution.Repository, name string, referenced blobSet) error {
	links, ok := repository.Blobs(ctx).(distribution.BlobEnumerator)
	if !ok {
		return fmt.Errorf("repository %s cannot enumerate its blobs", name)
	}
	if err := ignoreMissing(links.Enumerate(ctx, referenced.mark)); err != nil {
		return fmt.Errorf("mark blobs of %s: %w", name, err)
	}
	manifests, err := repository.Manifests(ctx)
	if err != nil {
		return fmt.Errorf("open manifests of %s: %w", name, err)
	}
	revisions, ok := manifests.(distribution.ManifestEnumerator)
	if !ok {
		return fmt.Errorf("repository %s cannot enumerate its manifests", name)
	}
	if err := ignoreMissing(revisions.Enumerate(ctx, referenced.mark)); err != nil {
		return fmt.Errorf("mark manifests of %s: %w", name, err)
	}
	return nil
}

func ignoreMissing(err error) error {
	var missing storagedriver.PathNotFoundError
	if errors.As(err, &missing) {
		return nil
	}
	return err
}
