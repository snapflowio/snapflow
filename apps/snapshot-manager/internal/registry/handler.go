// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"context"
	"net/http"
	"strings"

	"github.com/distribution/distribution/v3/registry/handlers"
	_ "github.com/distribution/distribution/v3/registry/storage/driver/filesystem"
	_ "github.com/distribution/distribution/v3/registry/storage/driver/s3-aws"
	"github.com/snapflowio/snapshot-manager/internal/directupload"
)

const (
	HealthPath        = "/healthz"
	healthResponse    = "ok"
	rootPath          = "/"
	registryAPIPrefix = "/v2"
)

func (server *Server) handler(ctx context.Context) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc(HealthPath, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write([]byte(healthResponse)); err != nil {
			server.options.logger.WarnContext(r.Context(), "Failed to write health response", "error", err)
		}
	})
	if server.uploads != nil {
		mux.Handle(directupload.PathPrefix, server.uploads.Handler(ctx))
	}
	mux.Handle(registryAPIPrefix+DockerHubMirrorPath+rootPath, mirrorRepositories(server.mirrorTags.handler(handlers.NewApp(ctx, server.mirror))))
	mux.Handle(rootPath, server.options.writes.handler(guardContentAddressedManifests(server.options.logger, handlers.NewApp(ctx, server.distribution))))
	return mux
}

func mirrorRepositories(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rewritten := r.Clone(r.Context())
		rewritten.URL.Path = registryAPIPrefix + strings.TrimPrefix(r.URL.Path, registryAPIPrefix+DockerHubMirrorPath)
		rewritten.URL.RawPath = ""
		next.ServeHTTP(w, rewritten)
	})
}
