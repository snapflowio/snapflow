// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package garbage

import "time"

type Schedule struct {
	Interval    time.Duration
	GracePeriod time.Duration
}

func (schedule Schedule) Valid() bool {
	return schedule.Interval > 0 && schedule.GracePeriod > 0
}

const (
	registryRoot     = "/docker/registry/v2"
	blobsRoot        = registryRoot + "/blobs"
	repositoriesRoot = registryRoot + "/repositories"
	blobDataFile     = "data"
	layerLinksDir    = "_layers"
	linkFile         = "link"
	blobShardLength  = 2
)
