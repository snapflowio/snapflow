// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tlsbundle

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/snapflowio/edge/internal/certs"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const syncInterval = 5 * time.Minute

var ErrTrustAnchorsChanged = errors.New("the edge trust anchors changed; restarting to apply them")

type Fetcher interface {
	TLSBundle(ctx context.Context) (*apiclient.EdgeTlsBundle, error)
}

func Install(ctx context.Context, config certs.Config, fetcher Fetcher) error {
	bundle, err := fetcher.TLSBundle(ctx)
	if err != nil {
		return fmt.Errorf("fetch the edge TLS bundle: %w", err)
	}
	return write(config, bundle)
}

type Syncer struct {
	config  certs.Config
	fetcher Fetcher
	logger  *slog.Logger
	digest  string
}

func NewSyncer(config certs.Config, fetcher Fetcher, logger *slog.Logger) (*Syncer, error) {
	if fetcher == nil || logger == nil {
		return nil, errors.New("TLS bundle syncer requires a fetcher and a logger")
	}
	return &Syncer{config: config, fetcher: fetcher, logger: logger}, nil
}

func (syncer *Syncer) Run(ctx context.Context) error {
	ticker := time.NewTicker(syncInterval)
	defer ticker.Stop()
	for {
		if err := syncer.sync(ctx); err != nil {
			if errors.Is(err, ErrTrustAnchorsChanged) {
				return err
			}
			syncer.logger.Warn("could not refresh the edge TLS bundle; serving the cached one", "error", err)
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func (syncer *Syncer) sync(ctx context.Context) error {
	bundle, err := syncer.fetcher.TLSBundle(ctx)
	if err != nil {
		return fmt.Errorf("fetch the edge TLS bundle: %w", err)
	}
	if bundle != nil && bundle.Digest == syncer.digest {
		return nil
	}
	if err := validate(bundle); err != nil {
		return err
	}
	trustChanged := anchorsChanged(syncer.config, bundle)
	if err := write(syncer.config, bundle); err != nil {
		return err
	}
	syncer.digest = bundle.Digest
	if trustChanged {
		return ErrTrustAnchorsChanged
	}
	return nil
}
