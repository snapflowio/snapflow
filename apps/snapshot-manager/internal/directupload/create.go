// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/distribution/reference"
	"github.com/opencontainers/go-digest"
	"github.com/snapflowio/snapshot-manager/internal/access"
	"github.com/snapflowio/snapshot-manager/internal/objectcredential"
)

const (
	maximumRequestBytes  = 4 << 10
	baseCredentialTTL    = time.Hour
	credentialTTLStep    = time.Hour
	credentialStepBytes  = 50 << 30
	maximumCredentialTTL = 12 * time.Hour
)

type createRequest struct {
	Repository string `json:"repository"`
	Digest     string `json:"digest"`
	Size       int64  `json:"size"`
}

type blobRequest struct {
	repository string
	digest     digest.Digest
	size       int64
}

func (service *Service) create(w http.ResponseWriter, r *http.Request) {
	requested, status, err := parseCreate(w, r)
	if err != nil {
		service.fail(w, r, status, err)
		return
	}
	subject, ok := service.authorize(w, r, access.PushAccess(requested.repository))
	if !ok || !service.allow(w, r, service.limits.create, subject) {
		return
	}
	linked, err := service.linkExisting(r.Context(), requested)
	if err != nil {
		service.failInternal(w, r, err)
		return
	}
	if linked {
		service.respond(w, r, http.StatusOK, uploadStatus{State: stateLinked})
		return
	}
	id := rand.Text()
	ttl := credentialTTL(requested.size)
	if !service.tracker.reserve(subject, id, time.Now().Add(ttl)) {
		service.throttle(w, r, activeUploadsBackoff, errTooManyUploads)
		return
	}
	started, err := service.start(r.Context(), record{
		ID:         id,
		Subject:    subject,
		Repository: requested.repository,
		Digest:     requested.digest,
		Size:       requested.size,
		State:      statePending,
	}, ttl)
	if err != nil {
		service.tracker.release(subject, id)
		service.failInternal(w, r, err)
		return
	}
	service.respond(w, r, http.StatusCreated, started)
}

func parseCreate(w http.ResponseWriter, r *http.Request) (blobRequest, int, error) {
	var body createRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maximumRequestBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil {
		return blobRequest{}, http.StatusBadRequest, fmt.Errorf("%w: %w", errMalformedRequest, err)
	}
	named, err := reference.WithName(body.Repository)
	if err != nil {
		return blobRequest{}, http.StatusBadRequest, fmt.Errorf("%w: %w", errInvalidRepository, err)
	}
	blob, err := digest.Parse(body.Digest)
	if err != nil || blob.Algorithm() != digest.SHA256 {
		return blobRequest{}, http.StatusBadRequest, errInvalidDigest
	}
	if body.Size < 1 {
		return blobRequest{}, http.StatusBadRequest, errBlobTooSmall
	}
	if body.Size > maximumBlobBytes {
		return blobRequest{}, http.StatusRequestEntityTooLarge, errBlobTooLarge
	}
	return blobRequest{repository: named.Name(), digest: blob, size: body.Size}, 0, nil
}

func credentialTTL(size int64) time.Duration {
	steps := (size + credentialStepBytes - 1) / credentialStepBytes
	return min(baseCredentialTTL+time.Duration(steps)*credentialTTLStep, maximumCredentialTTL)
}

func (service *Service) linkExisting(ctx context.Context, requested blobRequest) (bool, error) {
	service.config.Gate.RLock()
	defer service.config.Gate.RUnlock()
	present, err := service.exists(ctx, blobDataPath(requested.digest))
	if err != nil || !present {
		return false, err
	}
	return true, service.writeLink(ctx, requested.repository, requested.digest)
}

func (service *Service) start(ctx context.Context, pending record, ttl time.Duration) (uploadStatus, error) {
	key := service.config.Storage.S3BucketKey(stagedDataPath(pending.ID))
	credential, err := service.config.Issuer.Issue(ctx, objectcredential.Grant{
		Bucket: service.config.Bucket,
		Key:    key,
		TTL:    ttl,
	})
	if err != nil {
		return uploadStatus{}, fmt.Errorf("issue upload credential: %w", err)
	}
	pending.ExpiresAt = credential.Expires
	if err := service.saveRecord(ctx, pending); err != nil {
		return uploadStatus{}, err
	}
	started := statusOf(pending)
	started.Upload = &uploadTarget{
		Endpoint:        service.config.Endpoint,
		Region:          service.config.Region,
		Bucket:          service.config.Bucket,
		Key:             key,
		AccessKeyID:     credential.AccessKeyID,
		SecretAccessKey: credential.SecretAccessKey,
		SessionToken:    credential.SessionToken,
		ExpiresAt:       credential.Expires.Format(time.RFC3339),
		PartSizeBytes:   partSizeBytes,
	}
	return started, nil
}
