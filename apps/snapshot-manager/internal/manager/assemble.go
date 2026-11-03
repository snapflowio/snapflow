// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import (
	"sync"

	"github.com/snapflowio/snapshot-manager/internal/buildcache"
	"github.com/snapflowio/snapshot-manager/internal/registry"
)

const (
	registryComponentName   = "registry"
	buildCacheComponentName = "build cache janitor"
)

func assemble(config Config, configured options) (componentSet, error) {
	var components componentSet
	writes := &sync.RWMutex{}
	registryServer, err := registry.New(
		config.Registry,
		registry.WithLogger(configured.logger),
		registry.WithLogLevel(config.LogLevel),
		registry.WithVersion(configured.version),
		registry.WithWriteGate(writes),
	)
	if err != nil {
		return nil, err
	}
	components.register(registryComponentName, registryServer)
	storage, err := registry.DistributionStorage(config.Registry)
	if err != nil {
		return nil, err
	}
	janitor, err := buildcache.New(storage, writes, buildcache.WithLogger(configured.logger))
	if err != nil {
		return nil, err
	}
	components.register(buildCacheComponentName, janitor)
	return components, nil
}
