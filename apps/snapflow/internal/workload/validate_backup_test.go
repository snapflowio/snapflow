// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"testing"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const (
	backupVolumesFixture = "BackupVolumesPayload.json"
	restoreVolumeFixture = "RestoreVolumePayload.json"
	shortDataKey         = "c2VjcmV0LWtleQ=="
	foreignArtifactID    = "d4e5f6a7-b8c9-4d0e-8f1a-3b4c5d6e7f80"
)

func assertTamperedFixtureRejected[T proto.Message](t *testing.T, fixture string, newMessage func() T, tamper func(T)) {
	t.Helper()
	message := newMessage()
	if err := protojson.Unmarshal([]byte(readFixture(t, fixture)), message); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	tamper(message)
	encoded, err := protojson.Marshal(message)
	if err != nil {
		t.Fatalf("encode payload: %v", err)
	}
	assertInvalidRequest(t, Decode(string(encoded), newMessage()))
}

func TestDecodeRejectsInvalidBackupVolumesPayload(t *testing.T) {
	tests := map[string]func(*machinev1alpha1.BackupVolumesPayload){
		"no volumes":           func(payload *machinev1alpha1.BackupVolumesPayload) { payload.VolumeBackups = nil },
		"missing generation":   func(payload *machinev1alpha1.BackupVolumesPayload) { payload.AssignmentGeneration = 0 },
		"missing pack url":     func(payload *machinev1alpha1.BackupVolumesPayload) { payload.VolumeBackups[0].PackUploadUrl = "" },
		"missing manifest url": func(payload *machinev1alpha1.BackupVolumesPayload) { payload.VolumeBackups[0].ManifestUploadUrl = "" },
		"short data key":       func(payload *machinev1alpha1.BackupVolumesPayload) { payload.VolumeBackups[0].DataKey = shortDataKey },
		"invalid base artifact": func(payload *machinev1alpha1.BackupVolumesPayload) {
			payload.VolumeBackups[0].Base = &machinev1alpha1.VolumeBackupObject{}
		},
	}
	for name, tamper := range tests {
		t.Run(name, func(t *testing.T) {
			assertTamperedFixtureRejected(t, backupVolumesFixture, func() *machinev1alpha1.BackupVolumesPayload {
				return &machinev1alpha1.BackupVolumesPayload{}
			}, tamper)
		})
	}
}

func TestDecodeRejectsInvalidRestoreVolumeBackup(t *testing.T) {
	tests := map[string]func(*machinev1alpha1.RestoreVolumePayload){
		"missing manifest":   func(payload *machinev1alpha1.RestoreVolumePayload) { payload.Backup.Manifest = nil },
		"short manifest key": func(payload *machinev1alpha1.RestoreVolumePayload) { payload.Backup.Manifest.DataKey = shortDataKey },
		"pack without url":   func(payload *machinev1alpha1.RestoreVolumePayload) { payload.Backup.Packs[0].DownloadUrl = "" },
		"duplicated pack": func(payload *machinev1alpha1.RestoreVolumePayload) {
			payload.Backup.Packs = append(payload.Backup.Packs, payload.Backup.Packs[0])
		},
		"missing size": func(payload *machinev1alpha1.RestoreVolumePayload) { payload.Backup.ExpectedVolumeSizeBytes = 0 },
	}
	for name, tamper := range tests {
		t.Run(name, func(t *testing.T) {
			assertTamperedFixtureRejected(t, restoreVolumeFixture, func() *machinev1alpha1.RestoreVolumePayload {
				return &machinev1alpha1.RestoreVolumePayload{}
			}, tamper)
		})
	}
}

func TestDecodeAcceptsBackupVolumesWithBase(t *testing.T) {
	payload := &machinev1alpha1.BackupVolumesPayload{}
	if err := protojson.Unmarshal([]byte(readFixture(t, backupVolumesFixture)), payload); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	payload.VolumeBackups[0].Base = &machinev1alpha1.VolumeBackupObject{
		ArtifactId:  foreignArtifactID,
		DownloadUrl: "https://storage.example.com/download/manifest",
		DataKey:     payload.VolumeBackups[0].DataKey,
	}
	encoded, err := protojson.Marshal(payload)
	if err != nil {
		t.Fatalf("encode payload: %v", err)
	}
	if err := Decode(string(encoded), &machinev1alpha1.BackupVolumesPayload{}); err != nil {
		t.Fatalf("decode backup with base: %v", err)
	}
}
