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
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"

	"github.com/google/go-containerregistry/pkg/name"
	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"github.com/snapflowio/microvm-go/types"
	"golang.org/x/sync/errgroup"
)

const (
	directBlobLayersInFlight = 3
	directBlobSpoolPattern   = "push-*"
)

func (s *ImageStore) pushLayersDirect(
	ctx context.Context,
	image Image,
	ref name.Reference,
	registry *types.Registry,
	transport http.RoundTripper,
) (returnErr error) {
	if registry == nil || registry.Username == "" || registry.Password == "" {
		return errDirectBlobUnavailable
	}
	endpoint, err := url.Parse(registry.URL)
	if err != nil {
		return fmt.Errorf("parse registry URL: %w", err)
	}
	client := directBlobClient{
		client:   &http.Client{Transport: transport, CheckRedirect: refuseRedirect},
		base:     &url.URL{Scheme: endpoint.Scheme, Host: endpoint.Host},
		registry: registry,
		uploader: s.uploader,
	}
	layers, err := image.Layers()
	if err != nil {
		return fmt.Errorf("read image layers: %w", err)
	}
	if err := os.MkdirAll(s.paths.SystemBuildsDir(), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create image push directory: %w", err)
	}
	spoolDir, err := os.MkdirTemp(s.paths.SystemBuildsDir(), directBlobSpoolPattern)
	if err != nil {
		return fmt.Errorf("create image push workspace: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(spoolDir); err != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("remove image push workspace: %w", err))
		}
	}()
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(directBlobLayersInFlight)
	seen := make(map[gcr.Hash]struct{}, len(layers))
	for _, layer := range layers {
		digest, err := layer.Digest()
		if err != nil {
			return errors.Join(fmt.Errorf("read layer digest: %w", err), group.Wait())
		}
		if _, exists := seen[digest]; exists {
			continue
		}
		seen[digest] = struct{}{}
		group.Go(func() error {
			return s.pushLayerDirect(groupCtx, client, ref.Context().RepositoryStr(), layer, digest, spoolDir)
		})
	}
	return group.Wait()
}

func (s *ImageStore) pushLayerDirect(ctx context.Context, client directBlobClient, repository string, layer gcr.Layer, digest gcr.Hash, spoolDir string) error {
	mediaType, err := layer.MediaType()
	if err != nil {
		return fmt.Errorf("read layer %s media type: %w", digest, err)
	}
	if !mediaType.IsDistributable() {
		return nil
	}
	size, err := layer.Size()
	if err != nil {
		return fmt.Errorf("read layer %s size: %w", digest, err)
	}
	return client.push(ctx, repository, digest, size, func() (string, error) {
		return s.layerFile(layer, digest, spoolDir)
	})
}

func (s *ImageStore) layerFile(layer gcr.Layer, digest gcr.Hash, spoolDir string) (_ string, returnErr error) {
	if s.layout.hasBlob(digest) {
		return s.layout.blobPath(digest), nil
	}
	compressed, err := layer.Compressed()
	if err != nil {
		return "", fmt.Errorf("open layer %s: %w", digest, err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(compressed, "layer "+digest.String()))
	}()
	path := filepath.Join(spoolDir, digest.Hex)
	spool, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, filemode.PrivateFile)
	if err != nil {
		return "", fmt.Errorf("create layer %s spool: %w", digest, err)
	}
	_, copyErr := io.Copy(spool, compressed)
	if err := errors.Join(copyErr, resourcecleanup.Close(spool, "layer "+digest.String()+" spool")); err != nil {
		return "", fmt.Errorf("spool layer %s: %w", digest, err)
	}
	return path, nil
}

func refuseRedirect(*http.Request, []*http.Request) error {
	return http.ErrUseLastResponse
}
