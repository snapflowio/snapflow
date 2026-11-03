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
	"os"
	"time"

	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
)

const (
	artifactTransferTimeout = 2 * time.Hour
	backupContentType       = "application/vnd.snapflow.volume-backup"
)

// Remote moves backup objects through presigned URLs; hosts never hold
// object store credentials.
type Remote struct {
	policy transferpolicy.Policy
	client *http.Client
}

func NewRemote(policy transferpolicy.Policy) Remote {
	return Remote{policy: policy, client: transferClient()}
}

func transferClient() *http.Client {
	return &http.Client{
		Timeout: artifactTransferTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func (r Remote) PutFile(ctx context.Context, rawURL, path string) (returnErr error) {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open backup object: %w", err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(file, "backup object"))
	}()
	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat backup object: %w", err)
	}
	// The transport closes request bodies it is given; the file stays owned
	// here so its close error is reported.
	return r.Put(ctx, rawURL, io.NopCloser(file), info.Size())
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
	// An empty pack still needs an explicit zero length; a nil-length body
	// would otherwise be sent chunked, which presigned PUTs reject.
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

// Get downloads a whole object of at most limitBytes.
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

// Ranges returns a reader of byte ranges of the object at rawURL.
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
