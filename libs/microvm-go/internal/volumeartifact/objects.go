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
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
)

// Object is a stored manifest or pack: its artifact id, a presigned GET URL
// and the data key of the backup that wrote it.
type Object struct {
	ArtifactID string
	URL        string
	DataKey    string
}

type PublishRequest struct {
	VolumeID          string
	ArtifactID        string
	DataKey           string
	PackUploadURL     string
	ManifestUploadURL string
	Base              *Object
	SourcePath        string
	PackPath          string
}

type Published struct {
	PackSizeBytes         int64
	ManifestSizeBytes     int64
	ChangedBytes          int64
	ReferencedArtifactIDs []string
}

type RestoreObjects struct {
	VolumeID                string
	Manifest                Object
	Packs                   []Object
	ExpectedVolumeSizeBytes int64
	DestinationPath         string
}

func (r Remote) FetchManifest(ctx context.Context, object Object, volumeID string, maxVolumeSizeBytes int64) (Manifest, error) {
	sealed, err := r.Get(ctx, object.URL, ManifestSizeLimit(maxVolumeSizeBytes))
	if err != nil {
		return Manifest{}, fmt.Errorf("fetch backup manifest %s: %w", object.ArtifactID, err)
	}
	return OpenManifest(sealed, object.DataKey, volumeID, object.ArtifactID, maxVolumeSizeBytes)
}

// PublishBackup packs the changed blocks of the snapshot at SourcePath and
// uploads the pack before the manifest, so a stored manifest never references
// a pack that is missing.
func (r Remote) PublishBackup(ctx context.Context, request PublishRequest) (Published, error) {
	result, err := r.writePack(ctx, request)
	if err != nil {
		return Published{}, err
	}
	if err := r.PutFile(ctx, request.PackUploadURL, request.PackPath); err != nil {
		return Published{}, fmt.Errorf("upload backup pack: %w", err)
	}
	sealed, err := SealManifest(result.Manifest, request.DataKey)
	if err != nil {
		return Published{}, err
	}
	if err := r.Put(ctx, request.ManifestUploadURL, bytes.NewReader(sealed), int64(len(sealed))); err != nil {
		return Published{}, fmt.Errorf("upload backup manifest: %w", err)
	}
	return Published{
		PackSizeBytes:         result.PackSizeBytes,
		ManifestSizeBytes:     int64(len(sealed)),
		ChangedBytes:          result.ChangedBytes,
		ReferencedArtifactIDs: result.Manifest.ReferencedArtifactIDs(),
	}, nil
}

func (r Remote) writePack(ctx context.Context, request PublishRequest) (_ BackupResult, returnErr error) {
	source, err := os.Open(request.SourcePath)
	if err != nil {
		return BackupResult{}, fmt.Errorf("open volume snapshot: %w", err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(source, "volume snapshot"))
	}()
	info, err := source.Stat()
	if err != nil {
		return BackupResult{}, fmt.Errorf("stat volume snapshot: %w", err)
	}
	backup := BackupRequest{VolumeID: request.VolumeID, ArtifactID: request.ArtifactID, DataKey: request.DataKey}
	if request.Base != nil {
		base, err := r.FetchManifest(ctx, *request.Base, request.VolumeID, info.Size())
		if err != nil {
			return BackupResult{}, err
		}
		backup.Base = &base
	}
	pack, err := os.OpenFile(request.PackPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, filemode.PrivateFile)
	if err != nil {
		return BackupResult{}, fmt.Errorf("create backup pack: %w", err)
	}
	result, backupErr := Backup(ctx, source, pack, backup)
	if closeErr := resourcecleanup.Close(pack, "backup pack"); backupErr != nil || closeErr != nil {
		return BackupResult{}, errors.Join(backupErr, closeErr)
	}
	return result, nil
}

// RestoreBackup fetches the manifest and reads the referenced chunks straight
// from the packs with range requests into a sparse file.
func (r Remote) RestoreBackup(ctx context.Context, request RestoreObjects) error {
	if request.ExpectedVolumeSizeBytes <= 0 {
		return errors.New("expected restored volume size must be positive")
	}
	manifest, err := r.FetchManifest(ctx, request.Manifest, request.VolumeID, request.ExpectedVolumeSizeBytes)
	if err != nil {
		return err
	}
	packs := make(map[string]Pack, len(request.Packs))
	for _, object := range request.Packs {
		if _, exists := packs[object.ArtifactID]; exists {
			return fmt.Errorf("backup pack %s is provided more than once", object.ArtifactID)
		}
		ranges, err := r.Ranges(object.URL)
		if err != nil {
			return fmt.Errorf("backup pack %s: %w", object.ArtifactID, err)
		}
		packs[object.ArtifactID] = Pack{DataKey: object.DataKey, Ranges: ranges}
	}
	return Restore(ctx, request.DestinationPath, RestoreRequest{
		VolumeID: request.VolumeID, Manifest: manifest, Packs: packs,
		ExpectedVolumeSizeBytes: request.ExpectedVolumeSizeBytes,
	})
}
