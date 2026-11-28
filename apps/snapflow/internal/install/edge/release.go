// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"slices"
	"strings"

	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/supplychain/tuf"
)

const (
	digestPrefix          = "sha256:"
	partialReleaseSuffix  = ".partial"
	stateFileJSONIndent   = "  "
	stateFileJSONNoPrefix = ""
)

type installedRelease struct {
	Channel  tuf.Channel `json:"channel"`
	Version  string      `json:"version"`
	Identity string      `json:"identity"`
	Previous string      `json:"previous,omitempty"`
}

func statePath() string {
	return path.Join(installationRoot, stateFileName)
}

func readState() (installedRelease, error) {
	content, err := os.ReadFile(statePath())
	if err != nil {
		return installedRelease{}, fmt.Errorf("read the installed edge release: %w", err)
	}
	var state installedRelease
	if err := json.Unmarshal(content, &state); err != nil {
		return installedRelease{}, fmt.Errorf("decode the installed edge release: %w", err)
	}
	return state, nil
}

func writeState(state installedRelease) error {
	content, err := json.MarshalIndent(state, stateFileJSONNoPrefix, stateFileJSONIndent)
	if err != nil {
		return fmt.Errorf("encode the installed edge release: %w", err)
	}
	return atomicfile.WriteFile(statePath(), append(content, '\n'), unitMode)
}

func stage(ctx context.Context, client *tuf.Client, selected tuf.ChannelRelease) (identity string, resultErr error) {
	identity = strings.TrimPrefix(selected.SHA256, digestPrefix)
	directory := releaseDirectory(identity)
	if info, err := os.Stat(directory); err == nil && info.IsDir() {
		return identity, nil
	}
	downloaded, err := client.Download(ctx, selected)
	if err != nil {
		return "", err
	}
	defer func() {
		if removeErr := os.Remove(downloaded); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, removeErr)
		}
	}()
	if err := extract(downloaded, directory); err != nil {
		return "", err
	}
	return identity, nil
}

func extract(bundlePath, directory string) (resultErr error) {
	partial := directory + partialReleaseSuffix
	if err := os.RemoveAll(partial); err != nil {
		return fmt.Errorf("clear a partial edge release: %w", err)
	}
	if err := os.MkdirAll(partial, directoryMode); err != nil {
		return fmt.Errorf("create the edge release directory: %w", err)
	}
	defer func() {
		if resultErr != nil {
			resultErr = errors.Join(resultErr, os.RemoveAll(partial))
		}
	}()
	bundle, err := os.Open(bundlePath)
	if err != nil {
		return fmt.Errorf("open the edge bundle: %w", err)
	}
	defer func() { resultErr = errors.Join(resultErr, bundle.Close()) }()
	binary, err := os.OpenFile(path.Join(partial, tuf.EdgeBinaryName), os.O_CREATE|os.O_EXCL|os.O_WRONLY, binaryMode)
	if err != nil {
		return fmt.Errorf("create the edge binary: %w", err)
	}
	if err := errors.Join(tuf.ExtractEdgeBinary(bundle, binary), binary.Sync(), binary.Close()); err != nil {
		return err
	}
	if err := os.Rename(partial, directory); err != nil {
		return fmt.Errorf("publish the edge release: %w", err)
	}
	return atomicfile.SyncDirectory(path.Dir(directory))
}

func activate(identity string) error {
	return install.ReplaceLink(installationRoot, currentLinkName, path.Join(releasesDirectory, identity))
}

func prune(keep ...string) error {
	root := path.Join(installationRoot, releasesDirectory)
	entries, err := os.ReadDir(root)
	if err != nil {
		return fmt.Errorf("list edge releases: %w", err)
	}
	var failures []error
	for _, entry := range entries {
		if !slices.Contains(keep, entry.Name()) {
			failures = append(failures, os.RemoveAll(path.Join(root, entry.Name())))
		}
	}
	return errors.Join(failures...)
}
