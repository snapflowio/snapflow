// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"crypto/ed25519"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/theupdateframework/go-tuf/v2/metadata"
)

type trustedChain struct {
	root      *metadata.Metadata[metadata.RootType]
	timestamp *metadata.Metadata[metadata.TimestampType]
	snapshot  *metadata.Metadata[metadata.SnapshotType]
	targets   *metadata.Metadata[metadata.TargetsType]
	roles     map[string]*metadata.Metadata[metadata.TargetsType]
}

type onlineKeys struct {
	snapshot  []ed25519.PrivateKey
	timestamp []ed25519.PrivateKey
}

type delegator interface {
	VerifyDelegate(string, any) error
}

func loadTrustedChain(metadataRoot string, now time.Time) (*trustedChain, error) {
	root, err := loadLatestTrustedRoot(metadataRoot)
	if err != nil {
		return nil, fmt.Errorf("load TUF root: %w", err)
	}
	if root.Signed.IsExpired(now) {
		return nil, errors.New("latest TUF root metadata is expired")
	}
	chain := &trustedChain{root: root, roles: map[string]*metadata.Metadata[metadata.TargetsType]{}}
	chain.timestamp, err = loadVerified(metadata.Timestamp(), root, metadata.TIMESTAMP,
		filepath.Join(metadataRoot, timestampFileName), nil)
	if err != nil {
		return nil, err
	}
	snapshotMeta := chain.timestamp.Signed.Meta[metadata.SNAPSHOT+metadataExtension]
	if snapshotMeta == nil {
		return nil, errors.New("release TUF timestamp does not select snapshot metadata")
	}
	chain.snapshot, err = loadVerified(metadata.Snapshot(), root, metadata.SNAPSHOT,
		versionedPath(metadataRoot, snapshotMeta.Version, metadata.SNAPSHOT), snapshotMeta)
	if err != nil {
		return nil, err
	}
	targetsMeta := chain.snapshot.Signed.Meta[metadata.TARGETS+metadataExtension]
	if targetsMeta == nil {
		return nil, errors.New("release TUF snapshot does not select targets metadata")
	}
	chain.targets, err = loadVerified(metadata.Targets(), root, metadata.TARGETS,
		versionedPath(metadataRoot, targetsMeta.Version, metadata.TARGETS), targetsMeta)
	if err != nil {
		return nil, err
	}
	if chain.targets.Signed.Delegations == nil {
		return nil, errors.New("release TUF targets metadata has no channel delegations")
	}
	for _, delegated := range chain.targets.Signed.Delegations.Roles {
		roleMeta := chain.snapshot.Signed.Meta[delegated.Name+metadataExtension]
		if roleMeta == nil {
			return nil, fmt.Errorf("release TUF snapshot does not select %s metadata", delegated.Name)
		}
		document, err := loadVerified(metadata.Targets(), chain.targets, delegated.Name,
			versionedPath(metadataRoot, roleMeta.Version, delegated.Name), roleMeta)
		if err != nil {
			return nil, err
		}
		chain.roles[delegated.Name] = document
	}
	return chain, nil
}

func loadVerified[T metadata.Roles](
	loader *metadata.Metadata[T],
	trusted delegator,
	role, path string,
	expected *metadata.MetaFiles,
) (*metadata.Metadata[T], error) {
	encoded, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, fmt.Errorf("read TUF %s metadata: %w", role, err)
	}
	if expected != nil && (expected.Length != 0 || len(expected.Hashes) != 0) {
		if err := expected.VerifyLengthHashes(encoded); err != nil {
			return nil, fmt.Errorf("verify TUF %s metadata identity: %w", role, err)
		}
	}
	document, err := loader.FromBytes(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode TUF %s metadata: %w", role, err)
	}
	if err := trusted.VerifyDelegate(role, document); err != nil {
		return nil, fmt.Errorf("verify TUF %s metadata: %w", role, err)
	}
	return document, nil
}

func (chain *trustedChain) channel(channel Channel) (*metadata.Metadata[metadata.TargetsType], error) {
	role := chain.roles[string(channel)]
	if role == nil {
		return nil, fmt.Errorf("release TUF repository has no %s channel", channel)
	}
	return role, nil
}

func (chain *trustedChain) signTargets(metadataRoot string, keys []ed25519.PrivateKey, now time.Time) error {
	chain.targets.Signed.Version++
	chain.targets.Signed.Expires = now.Add(targetsValidity)
	if err := sign(chain.targets, keys); err != nil {
		return err
	}
	if err := chain.root.VerifyDelegate(metadata.TARGETS, chain.targets); err != nil {
		return fmt.Errorf("verify newly signed targets: %w", err)
	}
	contents, err := writeMetadataBytes(metadataRoot, versionedName(chain.targets.Signed.Version, metadata.TARGETS), chain.targets)
	if err != nil {
		return err
	}
	chain.snapshot.Signed.Meta[metadata.TARGETS+metadataExtension] = metaFile(chain.targets.Signed.Version, contents)
	return nil
}

func (chain *trustedChain) signChannel(metadataRoot string, channel Channel, keys []ed25519.PrivateKey, now time.Time) error {
	role, err := chain.channel(channel)
	if err != nil {
		return err
	}
	name := string(channel)
	role.Signed.Version++
	role.Signed.Expires = now.Add(roleValidity(name))
	if err := sign(role, keys); err != nil {
		return err
	}
	if err := chain.targets.VerifyDelegate(name, role); err != nil {
		return fmt.Errorf("verify newly signed %s metadata: %w", name, err)
	}
	contents, err := writeMetadataBytes(metadataRoot, versionedName(role.Signed.Version, name), role)
	if err != nil {
		return err
	}
	chain.snapshot.Signed.Meta[name+metadataExtension] = metaFile(role.Signed.Version, contents)
	return nil
}

func (chain *trustedChain) commit(metadataRoot string, keys onlineKeys, now time.Time) error {
	chain.snapshot.Signed.Version++
	chain.snapshot.Signed.Expires = now.Add(snapshotValidity)
	if err := sign(chain.snapshot, keys.snapshot); err != nil {
		return err
	}
	if err := chain.root.VerifyDelegate(metadata.SNAPSHOT, chain.snapshot); err != nil {
		return fmt.Errorf("verify newly signed snapshot: %w", err)
	}
	contents, err := writeMetadataBytes(metadataRoot, versionedName(chain.snapshot.Signed.Version, metadata.SNAPSHOT), chain.snapshot)
	if err != nil {
		return err
	}
	chain.timestamp.Signed.Meta[metadata.SNAPSHOT+metadataExtension] = metaFile(chain.snapshot.Signed.Version, contents)
	return chain.commitTimestamp(metadataRoot, keys.timestamp, now)
}

func (chain *trustedChain) commitTimestamp(metadataRoot string, keys []ed25519.PrivateKey, now time.Time) error {
	chain.timestamp.Signed.Version++
	chain.timestamp.Signed.Expires = now.Add(timestampValidity)
	if err := sign(chain.timestamp, keys); err != nil {
		return err
	}
	if err := chain.root.VerifyDelegate(metadata.TIMESTAMP, chain.timestamp); err != nil {
		return fmt.Errorf("verify newly signed timestamp: %w", err)
	}
	if err := writeMetadata(metadataRoot, timestampFileName, chain.timestamp); err != nil {
		return err
	}
	return syncDirectories(metadataRoot)
}

func readChannelRelease(
	targetsRoot string,
	role *metadata.Metadata[metadata.TargetsType],
	channel Channel,
	architecture string,
) (ChannelRelease, bool, error) {
	targetPath := channelPath(channel, architecture)
	info := role.Signed.Targets[targetPath]
	if info == nil {
		return ChannelRelease{}, false, nil
	}
	digest := info.Hashes[sha256HashName]
	if len(digest) != sha256.Size {
		return ChannelRelease{}, false, fmt.Errorf("%s has no SHA-256 identity", targetPath)
	}
	encoded, err := os.ReadFile(consistentTargetPath(targetsRoot, targetPath, digest))
	if err != nil {
		return ChannelRelease{}, false, fmt.Errorf("read %s: %w", targetPath, err)
	}
	if err := info.VerifyLengthHashes(encoded); err != nil {
		return ChannelRelease{}, false, fmt.Errorf("verify %s: %w", targetPath, err)
	}
	selected, err := decodeChannelRelease(encoded, channel, architecture)
	if err != nil {
		return ChannelRelease{}, false, err
	}
	return selected, true, nil
}

func writeChannelRelease(targetsRoot string, role *metadata.Metadata[metadata.TargetsType], selected ChannelRelease) error {
	contents, err := encodeChannelRelease(selected)
	if err != nil {
		return err
	}
	targetPath := channelPath(selected.Channel, selected.Architecture)
	hash := sha256.Sum256(contents)
	if err := writeFile(consistentTargetPath(targetsRoot, targetPath, hash[:]), contents); err != nil {
		return err
	}
	role.Signed.Targets[targetPath] = &metadata.TargetFiles{
		Path: targetPath, Length: int64(len(contents)), Hashes: metadata.Hashes{sha256HashName: hash[:]},
	}
	return nil
}

type repositoryPaths struct {
	root     string
	metadata string
	targets  string
}

func openRepository(root string) (repositoryPaths, error) {
	resolved, err := absoluteDirectory(root, "release TUF repository")
	if err != nil {
		return repositoryPaths{}, err
	}
	return repositoryPaths{
		root:     resolved,
		metadata: filepath.Join(resolved, metadataDirectoryName),
		targets:  filepath.Join(resolved, targetsDirectoryName),
	}, nil
}

func loadKeys(description string, paths ...string) ([]ed25519.PrivateKey, error) {
	if len(paths) == 0 {
		return nil, fmt.Errorf("%s key is required", description)
	}
	keys := make([]ed25519.PrivateKey, 0, len(paths))
	for _, path := range paths {
		key, err := loadPrivateKey(path)
		if err != nil {
			return nil, fmt.Errorf("%s key: %w", description, err)
		}
		keys = append(keys, key)
	}
	return keys, nil
}

func loadOnlineKeys(snapshotKey, timestampKey string) (onlineKeys, error) {
	snapshot, err := loadKeys(metadata.SNAPSHOT, snapshotKey)
	if err != nil {
		return onlineKeys{}, err
	}
	timestamp, err := loadKeys(metadata.TIMESTAMP, timestampKey)
	if err != nil {
		return onlineKeys{}, err
	}
	return onlineKeys{snapshot: snapshot, timestamp: timestamp}, nil
}
