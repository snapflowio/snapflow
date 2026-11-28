// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package buildcache

import "time"

const (
	SweepInterval           = time.Hour
	IdleRetention           = 7 * 24 * time.Hour
	OrganizationBudgetBytes = 10 << 30

	namespaceRoot       = "transient"
	cacheRepository     = "buildcache"
	cacheTag            = "cache"
	repositoryNameDepth = 4

	repositoriesRoot = "/docker/registry/v2/repositories"
	tagLinkSuffix    = "/_manifests/tags/" + cacheTag + "/current/link"
)
