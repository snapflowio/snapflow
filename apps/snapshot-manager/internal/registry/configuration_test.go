// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"errors"
	"log/slog"
	"testing"

	"github.com/distribution/distribution/v3/configuration"
	"github.com/snapflowio/snapshot-manager/internal/access"
	"github.com/snapflowio/snapshot-manager/internal/access/accesstest"
)

const (
	testStorageDir = "/data"
	testRegion     = "us-east-1"
	testBucket     = "snapshots"
	testEndpoint   = "http://rustfs:9000"
)

func testConfig(t *testing.T) Config {
	t.Helper()
	return testConfigWithIssuer(t, accesstest.NewIssuer(t))
}

func testConfigWithIssuer(t *testing.T, issuer *accesstest.TokenIssuer) Config {
	t.Helper()
	return Config{
		Addr:         ":0",
		Auth:         Auth{JWKSURL: issuer.JWKSURL()},
		DrainTimeout: testDrainTimeout,
		Storage:      Storage{Directory: t.TempDir()},
	}
}

func buildConfig(t *testing.T, cfg Config) *configuration.Configuration {
	t.Helper()
	verifier, err := access.NewVerifier(t.Context(), access.VerifierConfig{JWKSURL: cfg.Auth.JWKSURL})
	if err != nil {
		t.Fatalf("NewVerifier() error = %v", err)
	}
	registryConfig, err := distributionConfiguration(cfg, slog.LevelInfo, verifier)
	if err != nil {
		t.Fatalf("distributionConfiguration() error = %v", err)
	}
	return registryConfig
}

func TestBuildConfigAlwaysRequiresRegistryTokens(t *testing.T) {
	t.Parallel()

	registryConfig := buildConfig(t, testConfig(t))
	if registryConfig.Auth.Type() != access.Name {
		t.Fatalf("auth = %v, want %s", registryConfig.Auth, access.Name)
	}
	got := registryConfig.Auth.Parameters()
	if got[access.OptionRealm] != access.Realm {
		t.Fatalf("auth realm = %v, want %s", got[access.OptionRealm], access.Realm)
	}
	if verifier, ok := got[access.OptionVerifier].(*access.Verifier); !ok || verifier == nil {
		t.Fatalf("auth verifier = %v, want a token verifier", got[access.OptionVerifier])
	}
}

func TestBuildConfigStorage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		mutate func(*Config)
		want   configuration.Storage
	}{
		{
			name:   "filesystem with delete and cache",
			mutate: func(c *Config) { c.Storage.Directory = testStorageDir },
			want: configuration.Storage{
				StorageDriverFilesystem: {storageParamRootDir: testStorageDir},
				storageKeyDelete:        {storageParamEnabled: true},
				storageKeyCache:         {storageParamBlobCache: blobDescriptorCache},
			},
		},
		{
			name: "s3 with a custom endpoint",
			mutate: func(c *Config) {
				c.Storage.S3Region = testRegion
				c.Storage.S3Bucket = testBucket
				c.Storage.S3RegionEndpoint = testEndpoint
			},
			want: configuration.Storage{
				StorageDriverS3: {
					storageParamRegion:    testRegion,
					storageParamBucket:    testBucket,
					storageParamEndpoint:  testEndpoint,
					storageParamPathStyle: true,
				},
				storageKeyDelete: {storageParamEnabled: true},
				storageKeyCache:  {storageParamBlobCache: blobDescriptorCache},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			cfg := testConfig(t)
			test.mutate(&cfg)
			registryConfig := buildConfig(t, cfg)

			if len(registryConfig.Storage) != len(test.want) {
				t.Fatalf("Storage = %v, want %v", registryConfig.Storage, test.want)
			}
			for key, wantParams := range test.want {
				gotParams := registryConfig.Storage[key]
				if len(gotParams) != len(wantParams) {
					t.Fatalf("Storage[%s] = %v, want %v", key, gotParams, wantParams)
				}
				for param, wantValue := range wantParams {
					if gotParams[param] != wantValue {
						t.Fatalf("Storage[%s][%s] = %v, want %v", key, param, gotParams[param], wantValue)
					}
				}
			}
		})
	}
}

func TestBuildRequiresStorage(t *testing.T) {
	t.Parallel()

	builder := newConfigurationBuilder()
	builder.withDeleteEnabled()
	registryConfig, err := builder.build()
	if !errors.Is(err, ErrNoStorageDriver) {
		t.Fatalf("build() error = %v, want %v", err, ErrNoStorageDriver)
	}
	if registryConfig != nil {
		t.Fatal("build() returned a configuration alongside an error")
	}
}
