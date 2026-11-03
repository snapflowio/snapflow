// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sync"

	"github.com/distribution/distribution/v3/configuration"
	"github.com/snapflowio/common-go/pkg/httpserver"
	"github.com/snapflowio/snapshot-manager/internal/access"
)

const storageDirMode = 0o755

type Server struct {
	config       Config
	options      options
	distribution *configuration.Configuration
	mirror       *configuration.Configuration
	mirrorTags   *mirrorTags
	http         *http.Server
	stopKeys     context.CancelFunc
	drainOnce    sync.Once
	drainErr     error
}

func New(cfg Config, opts ...Option) (*Server, error) {
	if err := access.Register(); err != nil {
		return nil, err
	}
	configured := newOptions(opts)
	if cfg.Storage.Driver() == StorageDriverFilesystem {
		if err := os.MkdirAll(cfg.Storage.Directory, storageDirMode); err != nil {
			return nil, fmt.Errorf("failed to create storage directory: %w", err)
		}
	}
	keysContext, stopKeys := context.WithCancel(context.Background())
	server, err := newServer(keysContext, cfg, configured)
	if err != nil {
		stopKeys()
		return nil, err
	}
	server.stopKeys = stopKeys
	return server, nil
}

func newServer(keysContext context.Context, cfg Config, configured options) (*Server, error) {
	verifier, err := access.NewVerifier(keysContext, access.VerifierConfig{
		JWKSURL:        cfg.Auth.JWKSURL,
		DeniedSubjects: cfg.Auth.DeniedSubjects,
		Logger:         configured.logger,
	})
	if err != nil {
		return nil, err
	}
	distribution, err := distributionConfiguration(cfg, configured.logLevel, verifier)
	if err != nil {
		return nil, err
	}
	mirror, err := mirrorConfiguration(cfg, configured.logLevel, verifier)
	if err != nil {
		return nil, err
	}
	return &Server{
		config:       cfg,
		options:      configured,
		distribution: distribution,
		mirror:       mirror,
		mirrorTags:   newMirrorTags(),
		http: &http.Server{
			Addr:              cfg.Addr,
			ReadHeaderTimeout: httpserver.ReadHeaderTimeout,
			IdleTimeout:       httpserver.IdleTimeout,
		},
	}, nil
}

func (server *Server) Run(ctx context.Context) error {
	server.http.Handler = server.handler(ctx)
	server.options.logger.Info(
		"Snapflow snapshot-manager started",
		slog.String("version", server.options.version),
		slog.String("addr", server.config.Addr),
		slog.Any("storage", storageInfo(server.distribution.Storage)),
	)

	served := make(chan error, 1)
	go func() { served <- server.serve() }()

	select {
	case err := <-served:
		return err
	case <-ctx.Done():
		return server.Drain(context.WithoutCancel(ctx))
	}
}

func (server *Server) Drain(ctx context.Context) error {
	server.drainOnce.Do(func() {
		server.drainErr = server.shutdown(ctx)
	})
	return server.drainErr
}

func (server *Server) shutdown(ctx context.Context) error {
	defer server.stopKeys()
	server.options.logger.InfoContext(ctx, "Shutting down Snapflow snapshot-manager...")
	drainContext, cancel := context.WithTimeout(ctx, server.config.DrainTimeout)
	defer cancel()
	err := server.http.Shutdown(drainContext)
	if err == nil {
		return nil
	}
	if drainContext.Err() == nil {
		return fmt.Errorf("drain registry server: %w", err)
	}
	server.options.logger.WarnContext(ctx, "Registry drain did not finish in time, closing remaining connections",
		slog.Duration("drain_timeout", server.config.DrainTimeout))
	if closeErr := server.http.Close(); closeErr != nil {
		return fmt.Errorf("close registry server: %w", closeErr)
	}
	return nil
}

func (server *Server) serve() error {
	var err error
	if server.config.TLS.Enabled() {
		server.options.logger.Info(
			"Starting with TLS",
			slog.String("cert", server.config.TLS.Certificate),
		)
		err = server.http.ListenAndServeTLS(server.config.TLS.Certificate, server.config.TLS.Key)
	} else {
		err = server.http.ListenAndServe()
	}
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server error: %w", err)
	}
	return nil
}
