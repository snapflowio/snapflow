// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package objectcredential

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
)

const r2HostSuffix = ".r2.cloudflarestorage.com"

type Grant struct {
	Bucket string
	Key    string
	TTL    time.Duration
}

type Credential struct {
	AccessKeyID     string
	SecretAccessKey string
	SessionToken    string
	Expires         time.Time
}

type Issuer interface {
	Issue(ctx context.Context, grant Grant) (Credential, error)
}

func Supports(endpoint string) bool {
	host, err := r2Host(endpoint)
	return err == nil && host != ""
}

func New(ctx context.Context, endpoint, region string) (Issuer, error) {
	host, err := r2Host(endpoint)
	if err != nil {
		return nil, err
	}
	if host == "" {
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedEndpoint, endpoint)
	}
	awsConfig, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("load object storage credentials: %w", err)
	}
	return newR2Issuer(awsConfig.Credentials, host)
}

func r2Host(endpoint string) (string, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("parse object storage endpoint: %w", err)
	}
	if host := parsed.Hostname(); strings.HasSuffix(host, r2HostSuffix) {
		return host, nil
	}
	return "", nil
}
