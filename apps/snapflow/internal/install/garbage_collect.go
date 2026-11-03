// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/opencontainers/go-digest"
	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/snapflow/internal/release"
)

func (manager *Manager) GarbageCollect() (removed []string, resultErr error) {
	lock, err := manager.acquire()
	if err != nil {
		return nil, err
	}
	defer func() {
		resultErr = errors.Join(resultErr, lock.Close())
	}()
	if err := manager.requireMachineStopped(); err != nil {
		return nil, err
	}
	journal, err := manager.reconcile()
	if err != nil {
		return nil, err
	}
	retained, err := retainedReleases(journal)
	if err != nil {
		return nil, err
	}
	releasesRoot := filepath.Join(manager.cfg.InstallationRoot, release.ReleasesDirectoryName)
	entries, err := os.ReadDir(releasesRoot)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list installed releases: %w", err)
	}
	for _, entry := range entries {
		collected, err := manager.collect(releasesRoot, entry, retained)
		if err != nil {
			return removed, err
		}
		if collected {
			removed = append(removed, entry.Name())
		}
	}
	return removed, atomicfile.SyncDirectory(releasesRoot)
}

func retainedReleases(journal Journal) (map[string]struct{}, error) {
	records := []*ReleaseRecord{journal.Active, journal.Previous}
	retained := make(map[string]struct{}, len(records))
	for _, record := range records {
		if record == nil {
			continue
		}
		parsed, err := digest.Parse(record.Digest)
		if err != nil {
			return nil, fmt.Errorf("release journal contains an invalid digest: %w", err)
		}
		retained[parsed.Encoded()] = struct{}{}
	}
	return retained, nil
}

func (manager *Manager) collect(releasesRoot string, entry os.DirEntry, retained map[string]struct{}) (bool, error) {
	name := entry.Name()
	path := filepath.Join(releasesRoot, name)
	if !entry.IsDir() {
		return false, fmt.Errorf("refuse to remove unrecognized release entry %q", name)
	}
	if strings.HasPrefix(name, stagingPrefix) {
		if err := os.RemoveAll(path); err != nil {
			return false, fmt.Errorf("remove abandoned release staging directory %q: %w", name, err)
		}
		return true, nil
	}
	parsed, err := digest.Parse(digest.SHA256.String() + ":" + name)
	if err != nil || parsed.Encoded() != name {
		return false, fmt.Errorf("refuse to remove unrecognized release directory %q", name)
	}
	if _, keep := retained[name]; keep {
		return false, nil
	}
	if _, err := release.LoadVerified(path, manager.verifyConfig()); err != nil {
		return false, fmt.Errorf("refuse to remove unrecognized release directory %q: %w", name, err)
	}
	if err := os.RemoveAll(path); err != nil {
		return false, fmt.Errorf("remove inactive Snapflow release %q: %w", name, err)
	}
	return true, nil
}
