// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/distribution/distribution/v3/registry/auth"
	"github.com/distribution/distribution/v3/registry/storage/driver/s3-aws"
	"github.com/snapflowio/snapshot-manager/internal/objectcredential"
)

const (
	PathPrefix       = "/snapflow/v1/"
	uploadsPath      = PathPrefix + "blob-uploads"
	uploadIDValue    = "id"
	uploadPath       = uploadsPath + "/{" + uploadIDValue + "}"
	createPattern    = http.MethodPost + " " + uploadsPath
	completePattern  = http.MethodPost + " " + uploadPath + "/complete"
	statusPattern    = http.MethodGet + " " + uploadPath
	partSizeBytes    = 64 << 20
	maximumBlobBytes = 512 << 30
)

type SharedGate interface {
	RLock()
	RUnlock()
}

type Config struct {
	Storage  *s3.Driver
	Issuer   objectcredential.Issuer
	Access   auth.AccessController
	Gate     SharedGate
	Endpoint string
	Region   string
	Bucket   string
	Logger   *slog.Logger
}

type Service struct {
	config  Config
	tracker *uploadTracker
	limits  limits
}

func New(cfg Config) *Service {
	return &Service{config: cfg, tracker: newUploadTracker(), limits: newLimits()}
}

func (service *Service) Handler(lifetime context.Context) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc(createPattern, service.create)
	mux.Handle(completePattern, completion{service: service, lifetime: lifetime})
	mux.HandleFunc(statusPattern, service.status)
	return mux
}
