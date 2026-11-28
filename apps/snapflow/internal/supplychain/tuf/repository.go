// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"crypto"
	"crypto/ed25519"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sigstore/sigstore/pkg/signature"
	"github.com/theupdateframework/go-tuf/v2/metadata"
)

const (
	rootKeyCount  = 3
	rootThreshold = 2

	rootValidity      = 365 * 24 * time.Hour
	targetsValidity   = 365 * 24 * time.Hour
	channelValidity   = 365 * 24 * time.Hour
	snapshotValidity  = 14 * 24 * time.Hour
	timestampValidity = 3 * 24 * time.Hour
)

type Policy string

const (
	LocalPolicy      Policy = "local"
	ProductionPolicy Policy = "production"
)

type InitializeConfig struct {
	RepositoryRoot string
	PrivateKeyRoot string
	Policy         Policy
	Now            time.Time
}

type rolePolicy struct {
	rootKeys      int
	rootThreshold int
	channels      []Channel
}

type keySet map[string][]ed25519.PrivateKey

func ParsePolicy(value string) (Policy, error) {
	policy := Policy(strings.TrimSpace(value))
	if _, err := resolvePolicy(policy); err != nil {
		return "", err
	}
	return policy, nil
}

func resolvePolicy(name Policy) (rolePolicy, error) {
	switch name {
	case ProductionPolicy:
		return rolePolicy{
			rootKeys: rootKeyCount, rootThreshold: rootThreshold,
			channels: []Channel{BetaChannel, StableChannel},
		}, nil
	case LocalPolicy:
		return rolePolicy{rootKeys: 1, rootThreshold: 1, channels: []Channel{BetaChannel}}, nil
	default:
		return rolePolicy{}, errors.New("release TUF repository policy must be local or production")
	}
}

func roleValidity(role string) time.Duration {
	switch role {
	case metadata.ROOT:
		return rootValidity
	case metadata.TARGETS:
		return targetsValidity
	case metadata.SNAPSHOT:
		return snapshotValidity
	case metadata.TIMESTAMP:
		return timestampValidity
	default:
		return channelValidity
	}
}

func Initialize(cfg InitializeConfig) error {
	policy, err := resolvePolicy(cfg.Policy)
	if err != nil {
		return err
	}
	repositoryRoot, keyRoot, err := validateRoots(cfg.RepositoryRoot, cfg.PrivateKeyRoot)
	if err != nil {
		return err
	}
	if cfg.Now.IsZero() {
		return errors.New("repository ceremony time is required")
	}
	if err := requireAbsent(repositoryRoot, "repository ceremony output"); err != nil {
		return err
	}
	if err := requireAbsent(keyRoot, "private key ceremony output"); err != nil {
		return err
	}
	metadataRoot := filepath.Join(repositoryRoot, metadataDirectoryName)
	for _, directory := range []string{metadataRoot, filepath.Join(repositoryRoot, targetsDirectoryName)} {
		if err := os.MkdirAll(directory, repositoryDirectoryMode); err != nil {
			return fmt.Errorf("create TUF repository directory: %w", err)
		}
	}
	keys, err := generateKeys(keyRoot, policy)
	if err != nil {
		return err
	}
	if err := writeInitialMetadata(metadataRoot, policy, keys, cfg.Now.UTC()); err != nil {
		return err
	}
	return syncDirectories(metadataRoot, repositoryRoot, keyRoot)
}

func requireAbsent(path, description string) error {
	_, err := os.Stat(path)
	switch {
	case err == nil:
		return fmt.Errorf("%s already exists", description)
	case errors.Is(err, os.ErrNotExist):
		return nil
	default:
		return fmt.Errorf("inspect %s: %w", description, err)
	}
}

func generateKeys(root string, policy rolePolicy) (keySet, error) {
	counts := map[string]int{
		metadata.ROOT: policy.rootKeys, metadata.TARGETS: 1, metadata.SNAPSHOT: 1, metadata.TIMESTAMP: 1,
	}
	for _, channel := range policy.channels {
		counts[string(channel)] = 1
	}
	keys := make(keySet, len(counts))
	for role, count := range counts {
		for index := 1; index <= count; index++ {
			key, err := generatePrivateKey(filepath.Join(root, privateKeyName(role, index)))
			if err != nil {
				return nil, err
			}
			keys[role] = append(keys[role], key)
		}
	}
	return keys, nil
}

func writeInitialMetadata(metadataRoot string, policy rolePolicy, keys keySet, now time.Time) error {
	root := metadata.Root(now.Add(rootValidity))
	root.Signed.ConsistentSnapshot = true
	for _, role := range []string{metadata.ROOT, metadata.TARGETS, metadata.SNAPSHOT, metadata.TIMESTAMP} {
		if err := authorizeKeys(root, role, keys[role]); err != nil {
			return err
		}
	}
	root.Signed.Roles[metadata.ROOT].Threshold = policy.rootThreshold
	if err := sign(root, keys[metadata.ROOT]); err != nil {
		return err
	}
	if err := writeMetadata(metadataRoot, versionedName(initialVersion, metadata.ROOT), root); err != nil {
		return err
	}
	chain := &trustedChain{
		root:      root,
		timestamp: metadata.Timestamp(),
		snapshot:  metadata.Snapshot(),
		targets:   metadata.Targets(),
		roles:     map[string]*metadata.Metadata[metadata.TargetsType]{},
	}
	chain.timestamp.Signed.Version, chain.snapshot.Signed.Version, chain.targets.Signed.Version = 0, 0, 0
	chain.targets.Signed.Delegations = &metadata.Delegations{Keys: map[string]*metadata.Key{}}
	for _, channel := range policy.channels {
		if err := delegateChannel(chain.targets.Signed.Delegations, channel, keys[string(channel)][0]); err != nil {
			return err
		}
	}
	if err := chain.signTargets(metadataRoot, keys[metadata.TARGETS], now); err != nil {
		return err
	}
	for _, channel := range policy.channels {
		role := metadata.Targets()
		role.Signed.Version = 0
		chain.roles[string(channel)] = role
		if err := chain.signChannel(metadataRoot, channel, keys[string(channel)], now); err != nil {
			return err
		}
	}
	return chain.commit(metadataRoot, onlineKeys{snapshot: keys[metadata.SNAPSHOT], timestamp: keys[metadata.TIMESTAMP]}, now)
}

func delegateChannel(delegations *metadata.Delegations, channel Channel, privateKey ed25519.PrivateKey) error {
	keyID, key, err := publicKey(privateKey)
	if err != nil {
		return err
	}
	delegations.Keys[keyID] = key
	delegations.Roles = append(delegations.Roles, metadata.DelegatedRole{
		Name: string(channel), KeyIDs: []string{keyID}, Threshold: 1, Terminating: true,
		Paths: []string{channelPattern(channel)},
	})
	return nil
}

func publicKey(privateKey ed25519.PrivateKey) (string, *metadata.Key, error) {
	key, err := metadata.KeyFromPublicKey(privateKey.Public())
	if err != nil {
		return "", nil, fmt.Errorf("create TUF public key: %w", err)
	}
	keyID, err := key.ID()
	if err != nil {
		return "", nil, fmt.Errorf("identify TUF public key: %w", err)
	}
	return keyID, key, nil
}

func authorizeKeys(root *metadata.Metadata[metadata.RootType], role string, privateKeys []ed25519.PrivateKey) error {
	for _, privateKey := range privateKeys {
		_, key, err := publicKey(privateKey)
		if err != nil {
			return err
		}
		if err := root.Signed.AddKey(key, role); err != nil {
			return fmt.Errorf("authorize %s key: %w", role, err)
		}
	}
	return nil
}

func sign[T metadata.Roles](document *metadata.Metadata[T], privateKeys []ed25519.PrivateKey) error {
	document.ClearSignatures()
	for _, privateKey := range privateKeys {
		signer, err := signature.LoadSigner(privateKey, crypto.Hash(0))
		if err != nil {
			return fmt.Errorf("load TUF signer: %w", err)
		}
		if _, err := document.Sign(signer); err != nil {
			return fmt.Errorf("sign TUF metadata: %w", err)
		}
	}
	return nil
}

func metaFile(version int64, contents []byte) *metadata.MetaFiles {
	hash := sha256.Sum256(contents)
	return &metadata.MetaFiles{
		Version: version, Length: int64(len(contents)),
		Hashes: metadata.Hashes{sha256HashName: hash[:]},
	}
}

func writeMetadata[T metadata.Roles](root, name string, document *metadata.Metadata[T]) error {
	_, err := writeMetadataBytes(root, name, document)
	return err
}

func writeMetadataBytes[T metadata.Roles](root, name string, document *metadata.Metadata[T]) ([]byte, error) {
	contents, err := document.ToBytes(false)
	if err != nil {
		return nil, fmt.Errorf("encode TUF metadata %s: %w", name, err)
	}
	if err := writeFile(filepath.Join(root, name), contents); err != nil {
		return nil, err
	}
	return contents, nil
}

func validateRoots(repositoryRoot, keyRoot string) (string, string, error) {
	repositoryRoot, err := absoluteDirectory(repositoryRoot, "repository output")
	if err != nil {
		return "", "", err
	}
	keyRoot, err = absoluteDirectory(keyRoot, "private key output")
	if err != nil {
		return "", "", err
	}
	if contains(repositoryRoot, keyRoot) || contains(keyRoot, repositoryRoot) {
		return "", "", errors.New("private keys and the public repository must be separate directories")
	}
	return repositoryRoot, keyRoot, nil
}

func absoluteDirectory(value, description string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("%s is required", description)
	}
	resolved, err := filepath.Abs(filepath.Clean(value))
	if err != nil {
		return "", fmt.Errorf("resolve %s: %w", description, err)
	}
	return resolved, nil
}

func contains(parent, child string) bool {
	relative, err := filepath.Rel(parent, child)
	return err == nil &&
		(relative == "." || (relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))))
}
