// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import (
	"path"

	"github.com/opencontainers/go-digest"
)

const (
	stagingRoot      = "/direct-uploads"
	stagingStateFile = "state"
	stagingDataFile  = "data"
	registryRoot     = "/docker/registry/v2"
	blobsRoot        = registryRoot + "/blobs"
	repositoriesRoot = registryRoot + "/repositories"
	blobDataFile     = "data"
	layerLinksDir    = "_layers"
	linkFile         = "link"
	blobShardLength  = 2
)

func statePath(id string) string {
	return path.Join(stagingRoot, id, stagingStateFile)
}

func stagedDataPath(id string) string {
	return path.Join(stagingRoot, id, stagingDataFile)
}

func blobDataPath(blob digest.Digest) string {
	encoded := blob.Encoded()
	return path.Join(blobsRoot, blob.Algorithm().String(), encoded[:blobShardLength], encoded, blobDataFile)
}

func layerLinkPath(repository string, blob digest.Digest) string {
	return path.Join(repositoriesRoot, repository, layerLinksDir, blob.Algorithm().String(), blob.Encoded(), linkFile)
}
