// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package garbage

import (
	"context"
	"fmt"

	"github.com/distribution/distribution/v3"
	"github.com/distribution/distribution/v3/configuration"
	"github.com/distribution/distribution/v3/registry/storage"
	storagedriver "github.com/distribution/distribution/v3/registry/storage/driver"
	"github.com/distribution/distribution/v3/registry/storage/driver/factory"
	"github.com/distribution/reference"
)

type store struct {
	driver    storagedriver.StorageDriver
	namespace distribution.Namespace
}

func openStore(ctx context.Context, storageConfiguration configuration.Storage) (store, error) {
	driver, err := factory.Create(ctx, storageConfiguration.Type(), storageConfiguration.Parameters())
	if err != nil {
		return store{}, fmt.Errorf("open registry storage: %w", err)
	}
	namespace, err := storage.NewRegistry(ctx, driver, storage.EnableDelete)
	if err != nil {
		return store{}, fmt.Errorf("open registry namespace: %w", err)
	}
	return store{driver: driver, namespace: namespace}, nil
}

func (opened store) repository(ctx context.Context, name string) (distribution.Repository, error) {
	named, err := reference.WithName(name)
	if err != nil {
		return nil, fmt.Errorf("parse repository %s: %w", name, err)
	}
	repository, err := opened.namespace.Repository(ctx, named)
	if err != nil {
		return nil, fmt.Errorf("open repository %s: %w", name, err)
	}
	return repository, nil
}
