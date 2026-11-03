// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import "time"

const (
	StorageDriverFilesystem = "filesystem"
	StorageDriverS3         = "s3"
)

type Config struct {
	Addr         string
	Auth         Auth
	HTTPSecret   string
	DrainTimeout time.Duration
	Storage      Storage
	TLS          TLS
}

// Auth locates the api key set that signs registry tokens.
type Auth struct {
	JWKSURL        string
	DeniedSubjects []string
}

type Storage struct {
	Directory        string
	S3Region         string
	S3Bucket         string
	S3RegionEndpoint string
}

type TLS struct {
	Certificate string
	Key         string
}

func (storage Storage) Driver() string {
	if storage.S3Bucket != "" {
		return StorageDriverS3
	}
	return StorageDriverFilesystem
}

func (storage Storage) S3Configured() bool {
	return storage.S3Region != "" || storage.S3Bucket != "" || storage.S3RegionEndpoint != ""
}

func (tls TLS) Enabled() bool {
	return tls.Certificate != ""
}
