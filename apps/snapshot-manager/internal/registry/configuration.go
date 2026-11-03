// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"log/slog"
	"maps"
	"net/http"
	"path/filepath"

	"github.com/distribution/distribution/v3/configuration"
	"github.com/snapflowio/snapshot-manager/internal/access"
)

const (
	registryConfigVersion = "0.1"
	logFormatterText      = "text"
	catalogMaxEntries     = 1000

	storageKeyDelete          = "delete"
	storageKeyCache           = "cache"
	storageParamEnabled       = "enabled"
	storageParamBlobCache     = "blobdescriptor"
	storageParamRootDir       = "rootdirectory"
	storageParamRegion        = "region"
	storageParamBucket        = "bucket"
	storageParamEndpoint      = "regionendpoint"
	storageParamPathStyle     = "forcepathstyle"
	headerContentTypeOptions  = "X-Content-Type-Options"
	contentTypeOptionsNoSniff = "nosniff"

	blobDescriptorCache = "inmemory"

	DockerHubMirrorPath = "/mirror/docker.io"
	dockerHubRemoteURL  = "https://registry-1.docker.io"
)

func distributionConfiguration(cfg Config, logLevel slog.Level, verifier *access.Verifier) (*configuration.Configuration, error) {
	builder := newConfigurationBuilder()
	builder.withAddr(cfg.Addr)
	builder.withLogLevel(registryLogLevel(logLevel))
	builder.withRegistryStorage(cfg.Storage)
	builder.withAccessControl(verifier)

	if cfg.TLS.Enabled() {
		builder.withTLS(cfg.TLS.Certificate, cfg.TLS.Key)
	}

	if cfg.HTTPSecret != "" {
		builder.withHTTPSecret(cfg.HTTPSecret)
	}

	return builder.build()
}

func mirrorConfiguration(cfg Config, logLevel slog.Level, verifier *access.Verifier) (*configuration.Configuration, error) {
	builder := newConfigurationBuilder()
	builder.withLogLevel(registryLogLevel(logLevel))
	builder.withCache(blobDescriptorCache)
	builder.withMirrorAccessControl(verifier)
	builder.withProxy(dockerHubRemoteURL)

	switch cfg.Storage.Driver() {
	case StorageDriverFilesystem:
		builder.withFilesystemStorage(filepath.Join(cfg.Storage.Directory, DockerHubMirrorPath))
	case StorageDriverS3:
		params := s3Parameters(cfg.Storage)
		params[storageParamRootDir] = DockerHubMirrorPath
		builder.withS3Storage(cfg.Storage.S3Region, cfg.Storage.S3Bucket, params)
	}

	if cfg.HTTPSecret != "" {
		builder.withHTTPSecret(cfg.HTTPSecret)
	}

	return builder.build()
}

func s3Parameters(storage Storage) configuration.Parameters {
	params := configuration.Parameters{}
	if storage.S3RegionEndpoint != "" {
		params[storageParamEndpoint] = storage.S3RegionEndpoint
		params[storageParamPathStyle] = true
	}
	return params
}

type configurationBuilder struct {
	config *configuration.Configuration
}

func newConfigurationBuilder() *configurationBuilder {
	return &configurationBuilder{
		config: &configuration.Configuration{
			Version: registryConfigVersion,
			Log: configuration.Log{
				Formatter: logFormatterText,
			},
			HTTP: configuration.HTTP{
				Headers: http.Header{
					headerContentTypeOptions: []string{contentTypeOptionsNoSniff},
				},
			},
			Storage: make(configuration.Storage),
			Catalog: configuration.Catalog{
				MaxEntries: catalogMaxEntries,
			},
		},
	}
}

func (cb *configurationBuilder) withFilesystemStorage(rootDir string) {
	cb.config.Storage[StorageDriverFilesystem] = configuration.Parameters{
		storageParamRootDir: rootDir,
	}
}

func (cb *configurationBuilder) withS3Storage(region, bucket string, params configuration.Parameters) {
	s3Params := configuration.Parameters{
		storageParamRegion: region,
		storageParamBucket: bucket,
	}
	maps.Copy(s3Params, params)
	cb.config.Storage[StorageDriverS3] = s3Params
}

func (cb *configurationBuilder) withAddr(addr string) {
	cb.config.HTTP.Addr = addr
}

func (cb *configurationBuilder) withLogLevel(level string) {
	cb.config.Log.Level = configuration.Loglevel(level)
}

func (cb *configurationBuilder) withTLS(certFile, keyFile string) {
	cb.config.HTTP.TLS = configuration.TLS{
		Certificate: certFile,
		Key:         keyFile,
	}
}

func (cb *configurationBuilder) withAccessControl(verifier *access.Verifier) {
	cb.config.Auth = configuration.Auth{
		access.Name: access.Parameters(verifier),
	}
}

func (cb *configurationBuilder) withMirrorAccessControl(verifier *access.Verifier) {
	cb.config.Auth = configuration.Auth{
		access.MirrorName: access.MirrorParameters(verifier),
	}
}

func (cb *configurationBuilder) withProxy(remoteURL string) {
	cb.config.Proxy = configuration.Proxy{RemoteURL: remoteURL}
}

func (cb *configurationBuilder) withDeleteEnabled() {
	cb.config.Storage[storageKeyDelete] = configuration.Parameters{
		storageParamEnabled: true,
	}
}

func (cb *configurationBuilder) withCache(driver string) {
	cb.config.Storage[storageKeyCache] = configuration.Parameters{
		storageParamBlobCache: driver,
	}
}

func (cb *configurationBuilder) withHTTPSecret(secret string) {
	cb.config.HTTP.Secret = secret
}

func (cb *configurationBuilder) build() (*configuration.Configuration, error) {
	if cb.config.Storage.Type() == "" {
		return nil, ErrNoStorageDriver
	}
	return cb.config, nil
}

// DistributionStorage is the storage section the registry serves from, for
// components that read the same blobs without serving HTTP.
func DistributionStorage(cfg Config) (configuration.Storage, error) {
	builder := newConfigurationBuilder()
	builder.withRegistryStorage(cfg.Storage)
	distribution, err := builder.build()
	if err != nil {
		return nil, err
	}
	return distribution.Storage, nil
}

func (cb *configurationBuilder) withRegistryStorage(storage Storage) {
	cb.withDeleteEnabled()
	cb.withCache(blobDescriptorCache)
	switch storage.Driver() {
	case StorageDriverFilesystem:
		cb.withFilesystemStorage(storage.Directory)
	case StorageDriverS3:
		cb.withS3Storage(storage.S3Region, storage.S3Bucket, s3Parameters(storage))
	}
}
