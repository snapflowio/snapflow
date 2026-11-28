// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package garbage

import (
	"context"
	"errors"
	"fmt"
	"path"
	"time"

	"github.com/distribution/distribution/v3"
	storagedriver "github.com/distribution/distribution/v3/registry/storage/driver"
	"github.com/opencontainers/go-digest"
)

type digestSet map[digest.Digest]struct{}

func (set digestSet) has(blob digest.Digest) bool {
	_, present := set[blob]
	return present
}

type layerLink struct {
	repository string
	blob       digest.Digest
}

type marks struct {
	blobs      digestSet
	staleLinks []layerLink
}

func mark(ctx context.Context, opened store, cutoff time.Time) (marks, error) {
	enumerator, ok := opened.namespace.(distribution.RepositoryEnumerator)
	if !ok {
		return marks{}, errors.New("registry storage cannot enumerate repositories")
	}
	marked := marks{blobs: make(digestSet)}
	err := enumerator.Enumerate(ctx, func(name string) error {
		return marked.markRepository(ctx, opened, name, cutoff)
	})
	if err != nil {
		return marks{}, fmt.Errorf("mark referenced blobs: %w", err)
	}
	return marked, nil
}

func (marked *marks) markRepository(ctx context.Context, opened store, name string, cutoff time.Time) error {
	repository, err := opened.repository(ctx, name)
	if err != nil {
		return err
	}
	referenced, err := manifestReferences(ctx, repository, name)
	if err != nil {
		return err
	}
	for blob := range referenced {
		marked.blobs[blob] = struct{}{}
	}
	links, ok := repository.Blobs(ctx).(distribution.BlobEnumerator)
	if !ok {
		return fmt.Errorf("repository %s cannot enumerate its layer links", name)
	}
	err = links.Enumerate(ctx, func(blob digest.Digest) error {
		if referenced.has(blob) {
			return nil
		}
		modified, exists, err := modifiedAt(ctx, opened.driver, layerLinkPath(name, blob))
		if err != nil || !exists {
			return err
		}
		if modified.After(cutoff) {
			marked.blobs[blob] = struct{}{}
			return nil
		}
		marked.staleLinks = append(marked.staleLinks, layerLink{repository: name, blob: blob})
		return nil
	})
	if err := ignoreMissing(err); err != nil {
		return fmt.Errorf("mark layer links of %s: %w", name, err)
	}
	return nil
}

func manifestReferences(ctx context.Context, repository distribution.Repository, name string) (digestSet, error) {
	manifests, err := repository.Manifests(ctx)
	if err != nil {
		return nil, fmt.Errorf("open manifests of %s: %w", name, err)
	}
	revisions, ok := manifests.(distribution.ManifestEnumerator)
	if !ok {
		return nil, fmt.Errorf("repository %s cannot enumerate its manifests", name)
	}
	referenced := make(digestSet)
	err = revisions.Enumerate(ctx, func(revision digest.Digest) error {
		return markManifest(ctx, manifests, revision, referenced)
	})
	if err := ignoreMissing(err); err != nil {
		return nil, fmt.Errorf("mark manifests of %s: %w", name, err)
	}
	return referenced, nil
}

func markManifest(ctx context.Context, manifests distribution.ManifestService, revision digest.Digest, referenced digestSet) error {
	if referenced.has(revision) {
		return nil
	}
	referenced[revision] = struct{}{}
	manifest, err := manifests.Get(ctx, revision)
	if err != nil {
		return fmt.Errorf("read manifest %s: %w", revision, err)
	}
	for _, descriptor := range manifest.References() {
		if referenced.has(descriptor.Digest) {
			continue
		}
		child, err := manifests.Exists(ctx, descriptor.Digest)
		if err != nil {
			return fmt.Errorf("inspect reference %s of manifest %s: %w", descriptor.Digest, revision, err)
		}
		if child {
			if err := markManifest(ctx, manifests, descriptor.Digest, referenced); err != nil {
				return err
			}
			continue
		}
		referenced[descriptor.Digest] = struct{}{}
	}
	return nil
}

func modifiedAt(ctx context.Context, driver storagedriver.StorageDriver, target string) (time.Time, bool, error) {
	info, err := driver.Stat(ctx, target)
	var missing storagedriver.PathNotFoundError
	if errors.As(err, &missing) {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, fmt.Errorf("inspect %s: %w", target, err)
	}
	return info.ModTime(), true, nil
}

func layerLinkPath(repository string, blob digest.Digest) string {
	return path.Join(repositoriesRoot, repository, layerLinksDir, blob.Algorithm().String(), blob.Encoded(), linkFile)
}

func ignoreMissing(err error) error {
	var missing storagedriver.PathNotFoundError
	if errors.As(err, &missing) {
		return nil
	}
	return err
}
