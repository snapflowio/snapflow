// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"crypto/ed25519"
	"errors"
	"fmt"
	"maps"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/theupdateframework/go-tuf/v2/metadata"
)

type ResignConfig struct {
	RepositoryRoot string
	Role           string
	Keys           []string
	Replace        map[string]string
	SnapshotKey    string
	TimestampKey   string
	Now            time.Time
}

func GenerateKey(output string) error {
	path, err := absoluteDirectory(output, "new key path")
	if err != nil {
		return err
	}
	_, err = generatePrivateKey(path)
	return err
}

func Resign(cfg ResignConfig) error {
	if cfg.Now.IsZero() {
		return errors.New("release TUF ceremony time is required")
	}
	repository, err := openRepository(cfg.RepositoryRoot)
	if err != nil {
		return err
	}
	signers, err := loadKeys(cfg.Role, cfg.Keys...)
	if err != nil {
		return err
	}
	replacements, err := loadReplacements(cfg.Replace)
	if err != nil {
		return err
	}
	now := cfg.Now.UTC()
	chain, err := loadTrustedChain(repository.metadata, now)
	if err != nil {
		return err
	}
	switch cfg.Role {
	case metadata.ROOT:
		err = chain.resignRoot(repository.metadata, signers, replacements, now)
	case metadata.TARGETS:
		err = chain.resignTargets(repository.metadata, signers, replacements, now)
	default:
		return errors.New("only the root and targets roles are re-signed in an offline ceremony")
	}
	if err != nil {
		return err
	}
	if cfg.Role == metadata.ROOT && len(replacements) == 0 {
		return syncDirectories(repository.metadata)
	}
	keys, err := ceremonyOnlineKeys(cfg, replacements)
	if err != nil {
		return err
	}
	return chain.commit(repository.metadata, keys, now)
}

func (chain *trustedChain) resignRoot(
	metadataRoot string,
	signers []ed25519.PrivateKey,
	replacements map[string]ed25519.PrivateKey,
	now time.Time,
) error {
	if err := checkRootReplacements(replacements); err != nil {
		return err
	}
	next, err := chain.copyRoot()
	if err != nil {
		return err
	}
	if err := rotateRootKeys(next, replacements); err != nil {
		return err
	}
	next.Signed.Version++
	next.Signed.Expires = now.Add(rootValidity)
	if err := sign(next, signers); err != nil {
		return err
	}
	if err := chain.verifyRootSuccessor(next); err != nil {
		return err
	}
	if err := writeMetadata(metadataRoot, versionedName(next.Signed.Version, metadata.ROOT), next); err != nil {
		return err
	}
	chain.root = next
	if replacement, replaced := replacements[metadata.TARGETS]; replaced {
		return chain.signTargets(metadataRoot, []ed25519.PrivateKey{replacement}, now)
	}
	return nil
}

// checkRootReplacements allows the root ceremony to replace only the keys
// root itself delegates to: targets, snapshot and timestamp.
func checkRootReplacements(replacements map[string]ed25519.PrivateKey) error {
	for role := range replacements {
		if role != metadata.TARGETS && role != metadata.SNAPSHOT && role != metadata.TIMESTAMP {
			return fmt.Errorf("the root ceremony cannot replace the %s key", role)
		}
	}
	return nil
}

// copyRoot returns a deep copy of the current root to edit into its successor.
func (chain *trustedChain) copyRoot() (*metadata.Metadata[metadata.RootType], error) {
	encoded, err := chain.root.ToBytes(false)
	if err != nil {
		return nil, fmt.Errorf("encode current TUF root: %w", err)
	}
	next, err := metadata.Root().FromBytes(encoded)
	if err != nil {
		return nil, fmt.Errorf("copy current TUF root: %w", err)
	}
	return next, nil
}

// rotateRootKeys revokes every key of each replaced role and authorizes its
// replacement alone, with a threshold of one.
func rotateRootKeys(next *metadata.Metadata[metadata.RootType], replacements map[string]ed25519.PrivateKey) error {
	for _, role := range slices.Sorted(maps.Keys(replacements)) {
		for _, keyID := range slices.Clone(next.Signed.Roles[role].KeyIDs) {
			if err := next.Signed.RevokeKey(keyID, role); err != nil {
				return fmt.Errorf("revoke %s key: %w", role, err)
			}
		}
		if err := authorizeKeys(next, role, []ed25519.PrivateKey{replacements[role]}); err != nil {
			return err
		}
		next.Signed.Roles[role].Threshold = 1
	}
	return nil
}

// verifyRootSuccessor requires the new root to satisfy both the current
// root's threshold and its own, as TUF clients check on rotation.
func (chain *trustedChain) verifyRootSuccessor(next *metadata.Metadata[metadata.RootType]) error {
	if err := chain.root.VerifyDelegate(metadata.ROOT, next); err != nil {
		return fmt.Errorf("verify new root with the current root: %w", err)
	}
	if err := next.VerifyDelegate(metadata.ROOT, next); err != nil {
		return fmt.Errorf("verify new root with itself: %w", err)
	}
	return nil
}

func (chain *trustedChain) resignTargets(
	metadataRoot string,
	signers []ed25519.PrivateKey,
	replacements map[string]ed25519.PrivateKey,
	now time.Time,
) error {
	delegations := chain.targets.Signed.Delegations
	for _, name := range slices.Sorted(maps.Keys(replacements)) {
		index := slices.IndexFunc(delegations.Roles, func(role metadata.DelegatedRole) bool { return role.Name == name })
		if index < 0 {
			return fmt.Errorf("the targets ceremony cannot replace the %s key", name)
		}
		keyID, key, err := publicKey(replacements[name])
		if err != nil {
			return err
		}
		for _, previous := range delegations.Roles[index].KeyIDs {
			delete(delegations.Keys, previous)
		}
		delegations.Keys[keyID] = key
		delegations.Roles[index].KeyIDs = []string{keyID}
		delegations.Roles[index].Threshold = 1
	}
	if err := chain.signTargets(metadataRoot, signers, now); err != nil {
		return err
	}
	for _, name := range slices.Sorted(maps.Keys(replacements)) {
		if err := chain.signChannel(metadataRoot, Channel(name), []ed25519.PrivateKey{replacements[name]}, now); err != nil {
			return err
		}
	}
	return nil
}

func loadReplacements(paths map[string]string) (map[string]ed25519.PrivateKey, error) {
	replacements := make(map[string]ed25519.PrivateKey, len(paths))
	for role, path := range paths {
		key, err := loadPrivateKey(filepath.Clean(path))
		if err != nil {
			return nil, fmt.Errorf("replacement %s key: %w", role, err)
		}
		replacements[strings.TrimSpace(role)] = key
	}
	return replacements, nil
}

func ceremonyOnlineKeys(cfg ResignConfig, replacements map[string]ed25519.PrivateKey) (onlineKeys, error) {
	keys := onlineKeys{}
	for _, role := range []string{metadata.SNAPSHOT, metadata.TIMESTAMP} {
		selected := []ed25519.PrivateKey{}
		if replacement, replaced := replacements[role]; replaced && cfg.Role == metadata.ROOT {
			selected = append(selected, replacement)
		} else {
			path := cfg.SnapshotKey
			if role == metadata.TIMESTAMP {
				path = cfg.TimestampKey
			}
			loaded, err := loadKeys(role, path)
			if err != nil {
				return onlineKeys{}, err
			}
			selected = loaded
		}
		if role == metadata.SNAPSHOT {
			keys.snapshot = selected
		} else {
			keys.timestamp = selected
		}
	}
	return keys, nil
}
