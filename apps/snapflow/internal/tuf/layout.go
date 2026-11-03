// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"slices"

	"github.com/theupdateframework/go-tuf/v2/metadata"
)

const (
	metadataDirectoryName = "metadata"
	targetsDirectoryName  = "targets"
	metadataExtension     = ".json"
	rootFileName          = metadata.ROOT + metadataExtension
	timestampFileName     = metadata.TIMESTAMP + metadataExtension
	initialVersion        = 1

	sha256HashName     = "sha256"
	sha256DigestPrefix = sha256HashName + ":"
	sha256HexLength    = 2 * sha256.Size

	releaseOS = "linux"
)

func Architectures() []string {
	return []string{"amd64", "arm64"}
}

func supportedArchitecture(architecture string) bool {
	return slices.Contains(Architectures(), architecture)
}

func versionedName(version int64, role string) string {
	return fmt.Sprintf("%d.%s%s", version, role, metadataExtension)
}

func versionedPath(metadataRoot string, version int64, role string) string {
	return filepath.Join(metadataRoot, versionedName(version, role))
}

func sha256Digest(sum []byte) string {
	return sha256DigestPrefix + hex.EncodeToString(sum)
}

func channelPath(channel Channel, architecture string) string {
	return fmt.Sprintf("channels/%s/%s-%s%s", channel, releaseOS, architecture, metadataExtension)
}

func channelPattern(channel Channel) string {
	return fmt.Sprintf("channels/%s/*", channel)
}

func consistentTargetPath(root, targetPath string, sum []byte) string {
	directory, name := filepath.Split(filepath.FromSlash(targetPath))
	return filepath.Join(root, directory, hex.EncodeToString(sum)+"."+name)
}

type LocalSigningKeys struct {
	Role      string
	Snapshot  string
	Timestamp string
}

func LocalKeys(privateKeyRoot string) LocalSigningKeys {
	return LocalSigningKeys{
		Role:      filepath.Join(privateKeyRoot, privateKeyName(string(BetaChannel), initialVersion)),
		Snapshot:  filepath.Join(privateKeyRoot, privateKeyName(metadata.SNAPSHOT, initialVersion)),
		Timestamp: filepath.Join(privateKeyRoot, privateKeyName(metadata.TIMESTAMP, initialVersion)),
	}
}

func BootstrapRootPath(repositoryRoot string) string {
	return versionedPath(filepath.Join(repositoryRoot, metadataDirectoryName), initialVersion, metadata.ROOT)
}

func TimestampPath(repositoryRoot string) string {
	return filepath.Join(repositoryRoot, metadataDirectoryName, timestampFileName)
}
