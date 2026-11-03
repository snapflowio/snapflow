// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/tuf"
)

type Candidate struct {
	InstallationRequest
}

func Stage(ctx context.Context, profile config.Profile, channel tuf.Channel) (Candidate, error) {
	repository, err := profile.RepositoryConfig(nil)
	if err != nil {
		return Candidate{}, err
	}
	client, err := tuf.NewClient(repository)
	if err != nil {
		return Candidate{}, err
	}
	selected, err := client.Resolve(channel)
	if err != nil {
		return Candidate{}, err
	}
	bundlePath, err := client.Download(ctx, selected)
	if err != nil {
		return Candidate{}, err
	}
	candidate := Candidate{InstallationRequest{
		BundlePath: bundlePath,
		Channel:    channel,
		Digest:     selected.SHA256,
		Version:    selected.Version,
	}}
	if err := verifyCandidate(candidate); err != nil {
		return Candidate{}, errors.Join(err, candidate.Cleanup())
	}
	return candidate, nil
}

func verifyCandidate(candidate Candidate) (resultErr error) {
	verificationRoot, err := os.MkdirTemp(filepath.Dir(candidate.BundlePath), ".verify-")
	if err != nil {
		return fmt.Errorf("create Snapflow release verification directory: %w", err)
	}
	defer func() {
		if removeErr := os.RemoveAll(verificationRoot); removeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove Snapflow release verification directory: %w", removeErr))
		}
	}()
	bundle, err := os.Open(candidate.BundlePath)
	if err != nil {
		return fmt.Errorf("open staged Snapflow release: %w", err)
	}
	verified, extractErr := release.ExtractBundle(bundle, verificationRoot)
	closeErr := bundle.Close()
	if err := errors.Join(extractErr, closeErr); err != nil {
		return fmt.Errorf("verify staged Snapflow release: %w", err)
	}
	if verified.Manifest.Version != candidate.Version {
		return errors.New("staged Snapflow release does not match its signed channel version")
	}
	return nil
}

func (candidate Candidate) Cleanup() error {
	path := strings.TrimSpace(candidate.BundlePath)
	if path == "" {
		return nil
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove verified Snapflow release download: %w", err)
	}
	return nil
}

func Activate(ctx context.Context, profile config.Profile, candidate Candidate) (ReleaseRecord, error) {
	manager, err := New(ProfileConfig(profile))
	if err != nil {
		return ReleaseRecord{}, fmt.Errorf("initialize Snapflow release manager: %w", err)
	}
	return manager.InstallBundle(ctx, candidate.InstallationRequest)
}

func Install(ctx context.Context, profile config.Profile, channel tuf.Channel) (record ReleaseRecord, resultErr error) {
	candidate, err := Stage(ctx, profile, channel)
	if err != nil {
		return ReleaseRecord{}, err
	}
	defer func() {
		resultErr = errors.Join(resultErr, candidate.Cleanup())
	}()
	return Activate(ctx, profile, candidate)
}
