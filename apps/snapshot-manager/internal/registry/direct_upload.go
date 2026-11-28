// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"context"
	"fmt"

	"github.com/distribution/distribution/v3/configuration"
	"github.com/distribution/distribution/v3/registry/auth"
	"github.com/distribution/distribution/v3/registry/storage/driver/factory"
	"github.com/distribution/distribution/v3/registry/storage/driver/s3-aws"
	"github.com/snapflowio/snapshot-manager/internal/access"
	"github.com/snapflowio/snapshot-manager/internal/directupload"
	"github.com/snapflowio/snapshot-manager/internal/objectcredential"
)

func newDirectUploads(
	ctx context.Context,
	cfg Config,
	storage configuration.Storage,
	verifier *access.Verifier,
	configured options,
) (*directupload.Service, error) {
	controller, err := auth.GetAccessController(access.Name, access.Parameters(verifier))
	if err != nil {
		return nil, fmt.Errorf("create direct upload access controller: %w", err)
	}
	driver, err := factory.Create(ctx, storage.Type(), storage.Parameters())
	if err != nil {
		return nil, fmt.Errorf("open direct upload storage: %w", err)
	}
	objectStorage, ok := driver.(*s3.Driver)
	if !ok {
		return nil, ErrDirectUploadDriver
	}
	issuer, err := objectcredential.New(ctx, cfg.Storage.S3RegionEndpoint, cfg.Storage.S3Region)
	if err != nil {
		return nil, err
	}
	return directupload.New(directupload.Config{
		Storage:  objectStorage,
		Issuer:   issuer,
		Access:   controller,
		Gate:     configured.writes.gate,
		Endpoint: cfg.Storage.S3RegionEndpoint,
		Region:   cfg.Storage.S3Region,
		Bucket:   cfg.Storage.S3Bucket,
		Logger:   configured.logger,
	}), nil
}
