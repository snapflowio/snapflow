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
	"sort"
	"strings"
	"time"

	"github.com/distribution/distribution/v3"
	storagedriver "github.com/distribution/distribution/v3/registry/storage/driver"
	"github.com/distribution/reference"
	"github.com/opencontainers/go-digest"
)

type cacheEntry struct {
	organization string
	repository   string
	lastUsed     time.Time
	blobs        map[digest.Digest]int64
}

func cacheOrganization(repository string) (string, bool) {
	segments := strings.Split(repository, "/")
	if len(segments) != repositoryNameDepth || segments[0] != namespaceRoot || segments[2] != cacheRepository {
		return "", false
	}
	return segments[1], segments[1] != "" && segments[3] != ""
}

func listCaches(ctx context.Context, opened store) ([]cacheEntry, error) {
	enumerator, ok := opened.registry.(distribution.RepositoryEnumerator)
	if !ok {
		return nil, errors.New("build cache storage cannot enumerate repositories")
	}
	var caches []cacheEntry
	err := enumerator.Enumerate(ctx, func(name string) error {
		organization, isCache := cacheOrganization(name)
		if !isCache {
			return nil
		}
		lastUsed, err := cacheLastUsed(ctx, opened.driver, name)
		if err != nil {
			return err
		}
		blobs, err := cacheBlobs(ctx, opened.registry, name)
		if err != nil {
			return err
		}
		caches = append(caches, cacheEntry{organization: organization, repository: name, lastUsed: lastUsed, blobs: blobs})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("list build caches: %w", err)
	}
	return caches, nil
}

func cacheLastUsed(ctx context.Context, driver storagedriver.StorageDriver, repository string) (time.Time, error) {
	info, err := driver.Stat(ctx, repositoriesRoot+"/"+repository+tagLinkSuffix)
	var missing storagedriver.PathNotFoundError
	if errors.As(err, &missing) {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, fmt.Errorf("inspect build cache %s: %w", repository, err)
	}
	return info.ModTime(), nil
}

func openRepository(ctx context.Context, namespace distribution.Namespace, name string) (distribution.Repository, error) {
	named, err := reference.WithName(name)
	if err != nil {
		return nil, fmt.Errorf("parse repository %s: %w", name, err)
	}
	repository, err := namespace.Repository(ctx, named)
	if err != nil {
		return nil, fmt.Errorf("open repository %s: %w", name, err)
	}
	return repository, nil
}

func cacheBlobs(ctx context.Context, namespace distribution.Namespace, name string) (map[digest.Digest]int64, error) {
	repository, err := openRepository(ctx, namespace, name)
	if err != nil {
		return nil, err
	}
	links, ok := repository.Blobs(ctx).(distribution.BlobEnumerator)
	if !ok {
		return nil, fmt.Errorf("repository %s cannot enumerate its blobs", name)
	}
	sizes := make(map[digest.Digest]int64)
	err = links.Enumerate(ctx, func(linked digest.Digest) error {
		descriptor, statErr := namespace.BlobStatter().Stat(ctx, linked)
		if errors.Is(statErr, distribution.ErrBlobUnknown) {
			return nil
		}
		if statErr != nil {
			return statErr
		}
		sizes[linked] = descriptor.Size
		return nil
	})
	var missing storagedriver.PathNotFoundError
	if err != nil && !errors.As(err, &missing) {
		return nil, fmt.Errorf("measure build cache %s: %w", name, err)
	}
	return sizes, nil
}

func evictionCandidates(caches []cacheEntry, now time.Time) []cacheEntry {
	byOrganization := make(map[string][]cacheEntry)
	for _, cache := range caches {
		byOrganization[cache.organization] = append(byOrganization[cache.organization], cache)
	}
	var candidates []cacheEntry
	for _, organizationCaches := range byOrganization {
		candidates = append(candidates, organizationCandidates(organizationCaches, now)...)
	}
	return candidates
}

func organizationCandidates(caches []cacheEntry, now time.Time) []cacheEntry {
	sort.Slice(caches, func(left, right int) bool {
		return caches[left].lastUsed.After(caches[right].lastUsed)
	})
	retained := make(blobSet)
	retainedBytes := int64(0)
	var candidates []cacheEntry
	for index, cache := range caches {
		if now.Sub(cache.lastUsed) > IdleRetention {
			candidates = append(candidates, cache)
			continue
		}
		added := unretainedBytes(cache.blobs, retained)
		if index > 0 && retainedBytes+added > OrganizationBudgetBytes {
			candidates = append(candidates, cache)
			continue
		}
		for blob := range cache.blobs {
			retained[blob] = struct{}{}
		}
		retainedBytes += added
	}
	return candidates
}

func unretainedBytes(blobs map[digest.Digest]int64, retained blobSet) int64 {
	added := int64(0)
	for blob, size := range blobs {
		if _, counted := retained[blob]; !counted {
			added += size
		}
	}
	return added
}
