// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package imagecache

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/cenkalti/backoff/v5"
	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/snapflowio/microvm-go/internal/objectupload"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"github.com/snapflowio/microvm-go/types"
)

const (
	directBlobUploadsPath    = "/snapflow/v1/blob-uploads"
	directBlobCompletePath   = "complete"
	directBlobPollInterval   = 2 * time.Second
	directBlobMaxAttempts    = 20
	directBlobResponseLimit  = 64 << 10
	directBlobJSONType       = "application/json"
	headerContentType        = "Content-Type"
	headerRetryAfter         = "Retry-After"
	statusOriginTimeout      = 524
	directBlobStateLinked    = "linked"
	directBlobStatePending   = "pending"
	directBlobStateFailed    = "failed"
	directBlobRequestTimeout = time.Minute
)

var (
	errDirectBlobUnavailable = errors.New("registry does not accept direct blob uploads")
	errDirectBlobNotFound    = errors.New("registry upload API not found")
	errDirectBlobFailed      = errors.New("registry rejected the uploaded blob")
)

type directBlobClient struct {
	client   *http.Client
	base     *url.URL
	registry *types.Registry
	uploader objectupload.Uploader
}

type directBlobRequest struct {
	Repository string `json:"repository"`
	Digest     string `json:"digest"`
	Size       int64  `json:"size"`
}

type directBlobStatus struct {
	ID     string            `json:"id"`
	State  string            `json:"state"`
	Error  string            `json:"error"`
	Upload *directBlobTarget `json:"upload"`
}

type directBlobTarget struct {
	Endpoint        string    `json:"endpoint"`
	Region          string    `json:"region"`
	Bucket          string    `json:"bucket"`
	Key             string    `json:"key"`
	AccessKeyID     string    `json:"accessKeyId"`
	SecretAccessKey string    `json:"secretAccessKey"`
	SessionToken    string    `json:"sessionToken"`
	ExpiresAt       time.Time `json:"expiresAt"`
	PartSizeBytes   int64     `json:"partSizeBytes"`
}

func (target directBlobTarget) objectTarget() objectupload.Target {
	return objectupload.Target{
		Endpoint: target.Endpoint, Region: target.Region, Bucket: target.Bucket, Key: target.Key,
		AccessKeyID: target.AccessKeyID, SecretAccessKey: target.SecretAccessKey, SessionToken: target.SessionToken,
		ExpiresAt: target.ExpiresAt, PartSizeBytes: target.PartSizeBytes,
	}
}

func (c directBlobClient) push(ctx context.Context, repository string, blob gcr.Hash, size int64, source func() (string, error)) error {
	payload, err := json.Marshal(directBlobRequest{Repository: repository, Digest: blob.String(), Size: size})
	if err != nil {
		return fmt.Errorf("encode direct upload request: %w", err)
	}
	created, err := c.call(ctx, http.MethodPost, payload, directBlobUploadsPath)
	if errors.Is(err, errDirectBlobNotFound) {
		return errDirectBlobUnavailable
	}
	if err != nil {
		return fmt.Errorf("start direct upload of %s: %w", blob, err)
	}
	if created.State == directBlobStateLinked {
		return nil
	}
	if created.Upload == nil {
		return fmt.Errorf("registry returned no upload target for %s", blob)
	}
	path, err := source()
	if err != nil {
		return err
	}
	if err := c.uploader.Upload(ctx, created.Upload.objectTarget(), path); err != nil {
		return fmt.Errorf("upload layer %s: %w", blob, err)
	}
	if err := c.await(ctx, created.ID); err != nil {
		return fmt.Errorf("link layer %s: %w", blob, err)
	}
	return nil
}

func (c directBlobClient) await(ctx context.Context, id string) error {
	status, err := c.call(ctx, http.MethodPost, nil, directBlobUploadsPath, id, directBlobCompletePath)
	ticker := time.NewTicker(directBlobPollInterval)
	defer ticker.Stop()
	for err == nil {
		switch status.State {
		case directBlobStateLinked:
			return nil
		case directBlobStateFailed:
			return fmt.Errorf("%w: %s", errDirectBlobFailed, status.Error)
		}
		select {
		case <-ctx.Done():
			return context.Cause(ctx)
		case <-ticker.C:
		}
		status, err = c.call(ctx, http.MethodGet, nil, directBlobUploadsPath, id)
		if err == nil && status.State == directBlobStatePending {
			status, err = c.call(ctx, http.MethodPost, nil, directBlobUploadsPath, id, directBlobCompletePath)
		}
	}
	return err
}

func (c directBlobClient) call(ctx context.Context, method string, payload []byte, path ...string) (directBlobStatus, error) {
	return backoff.Retry(ctx, func() (directBlobStatus, error) {
		return c.send(ctx, method, payload, c.base.JoinPath(path...))
	}, backoff.WithMaxTries(directBlobMaxAttempts))
}

func (c directBlobClient) send(ctx context.Context, method string, payload []byte, endpoint *url.URL) (_ directBlobStatus, returnErr error) {
	requestCtx, cancel := context.WithTimeout(ctx, directBlobRequestTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestCtx, method, endpoint.String(), bytes.NewReader(payload))
	if err != nil {
		return directBlobStatus{}, backoff.Permanent(fmt.Errorf("create registry upload request: %w", err))
	}
	request.SetBasicAuth(c.registry.Username, c.registry.Password)
	if payload != nil {
		request.Header.Set(headerContentType, directBlobJSONType)
	}
	response, err := c.client.Do(request)
	if err != nil {
		return directBlobStatus{}, fmt.Errorf("call registry upload API: %w", err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(response.Body, "registry upload response"))
	}()
	body, err := io.ReadAll(io.LimitReader(response.Body, directBlobResponseLimit))
	if err != nil {
		return directBlobStatus{}, fmt.Errorf("read registry upload response: %w", err)
	}
	var status directBlobStatus
	decodeErr := json.Unmarshal(body, &status)
	switch response.StatusCode {
	case http.StatusOK, http.StatusCreated, http.StatusAccepted:
		if decodeErr != nil {
			return directBlobStatus{}, backoff.Permanent(fmt.Errorf("decode registry upload response: %w", decodeErr))
		}
		return status, nil
	}
	failure := fmt.Errorf("registry upload API returned %s: %s", response.Status, failureMessage(status, decodeErr, body))
	switch response.StatusCode {
	case http.StatusTooManyRequests:
		return directBlobStatus{}, throttled(failure, response.Header.Get(headerRetryAfter))
	case http.StatusServiceUnavailable, statusOriginTimeout:
		return directBlobStatus{}, failure
	case http.StatusNotFound:
		return directBlobStatus{}, backoff.Permanent(fmt.Errorf("%w: %w", errDirectBlobNotFound, failure))
	default:
		return directBlobStatus{}, backoff.Permanent(failure)
	}
}

func failureMessage(status directBlobStatus, decodeErr error, body []byte) string {
	if decodeErr == nil && status.Error != "" {
		return status.Error
	}
	return strings.TrimSpace(string(body))
}

func throttled(failure error, retryAfter string) error {
	seconds, err := strconv.Atoi(strings.TrimSpace(retryAfter))
	if err != nil || seconds < 1 {
		return failure
	}
	return errors.Join(failure, backoff.RetryAfter(seconds))
}
