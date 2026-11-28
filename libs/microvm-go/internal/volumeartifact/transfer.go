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

package volumeartifact

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/snapflowio/microvm-go/internal/objectupload"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
)

const (
	artifactTransferTimeout = 2 * time.Hour
	backupContentType       = "application/vnd.snapflow.volume-backup"
)

type Remote struct {
	policy   transferpolicy.Policy
	client   *http.Client
	uploader objectupload.Uploader
}

func NewRemote(policy transferpolicy.Policy) Remote {
	return Remote{policy: policy, client: transferClient(), uploader: objectupload.New(policy)}
}

func transferClient() *http.Client {
	return &http.Client{
		Timeout: artifactTransferTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func (r Remote) Put(ctx context.Context, rawURL string, body io.Reader, sizeBytes int64) error {
	target, err := r.policy.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("backup upload URL: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, target.String(), body)
	if err != nil {
		return fmt.Errorf("create backup upload request: %w", err)
	}
	request.ContentLength = sizeBytes
	if sizeBytes == 0 {
		request.Body = http.NoBody
	}
	request.Header.Set("Content-Type", backupContentType)
	response, err := r.client.Do(request)
	if err != nil {
		return fmt.Errorf("upload backup object: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return statusError(response, "upload backup object")
	}
	return resourcecleanup.Close(response.Body, "backup upload response")
}

func (r Remote) Get(ctx context.Context, rawURL string, limitBytes int64) (_ []byte, returnErr error) {
	target, err := r.policy.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("backup download URL: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create backup download request: %w", err)
	}
	response, err := r.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("download backup object: %w", err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(response.Body, "backup download"))
	}()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download backup object: object store returned %s", response.Status)
	}
	if response.ContentLength > limitBytes {
		return nil, fmt.Errorf("download backup object: %d bytes exceeds the %d byte limit", response.ContentLength, limitBytes)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, limitBytes+1))
	if err != nil {
		return nil, fmt.Errorf("download backup object: %w", err)
	}
	if int64(len(data)) > limitBytes {
		return nil, fmt.Errorf("download backup object: exceeds the %d byte limit", limitBytes)
	}
	return data, nil
}

func (r Remote) Ranges(rawURL string) (RangeReader, error) {
	target, err := r.policy.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("backup pack URL: %w", err)
	}
	return remoteRanges{client: r.client, target: target}, nil
}

type remoteRanges struct {
	client *http.Client
	target *url.URL
}

func (r remoteRanges) ReadRange(ctx context.Context, offset, length int64) (io.ReadCloser, error) {
	if offset < 0 || length <= 0 {
		return nil, fmt.Errorf("invalid pack range %d+%d", offset, length)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, r.target.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create pack range request: %w", err)
	}
	request.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", offset, offset+length-1))
	response, err := r.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("download pack range: %w", err)
	}
	if response.StatusCode != http.StatusPartialContent {
		return nil, statusError(response, "download pack range")
	}
	if response.ContentLength >= 0 && response.ContentLength != length {
		return nil, errors.Join(
			fmt.Errorf("download pack range: expected %d bytes, got %d", length, response.ContentLength),
			resourcecleanup.Close(response.Body, "pack range"),
		)
	}
	return rangeBody{Reader: io.LimitReader(response.Body, length), Closer: response.Body}, nil
}

type rangeBody struct {
	io.Reader
	io.Closer
}

func statusError(response *http.Response, action string) error {
	return errors.Join(
		fmt.Errorf("%s: object store returned %s", action, response.Status),
		resourcecleanup.Close(response.Body, action+" response"),
	)
}
