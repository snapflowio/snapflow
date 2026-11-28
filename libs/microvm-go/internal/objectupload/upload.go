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

package objectupload

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
)

const (
	requestTimeout     = 30 * time.Minute
	maxRequestAttempts = 8
)

type Uploader struct {
	policy transferpolicy.Policy
	client *http.Client
}

func New(policy transferpolicy.Policy) Uploader {
	return Uploader{
		policy: policy,
		client: &http.Client{
			Timeout: requestTimeout,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

func (u Uploader) Upload(ctx context.Context, target Target, path string) (returnErr error) {
	if err := target.validate(time.Now()); err != nil {
		return err
	}
	endpoint, err := u.policy.Parse(target.Endpoint)
	if err != nil {
		return fmt.Errorf("object upload endpoint: %w", err)
	}
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open upload source: %w", err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(file, "upload source"))
	}()
	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat upload source: %w", err)
	}
	partSize, err := target.partSize(info.Size())
	if err != nil {
		return err
	}
	upload := objectUpload{
		client: u.s3Client(target, endpoint.String()),
		target: target,
		file:   file,
		size:   info.Size(),
	}
	if upload.size <= partSize {
		return upload.put(ctx)
	}
	return upload.multipart(ctx, partSize)
}

func (u Uploader) s3Client(target Target, endpoint string) *s3.Client {
	return s3.New(s3.Options{
		BaseEndpoint:               aws.String(endpoint),
		Region:                     target.Region,
		UsePathStyle:               true,
		Credentials:                credentials.NewStaticCredentialsProvider(target.AccessKeyID, target.SecretAccessKey, target.SessionToken),
		HTTPClient:                 u.client,
		RetryMaxAttempts:           maxRequestAttempts,
		RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired,
		ResponseChecksumValidation: aws.ResponseChecksumValidationWhenRequired,
	})
}

type objectUpload struct {
	client *s3.Client
	target Target
	file   *os.File
	size   int64
}

func (upload objectUpload) put(ctx context.Context) error {
	_, err := upload.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(upload.target.Bucket),
		Key:           aws.String(upload.target.Key),
		ContentType:   optionalString(upload.target.ContentType),
		ContentLength: aws.Int64(upload.size),
		Body:          io.NewSectionReader(upload.file, 0, upload.size),
	})
	if err != nil {
		return fmt.Errorf("upload object %s: %w", upload.target.Key, err)
	}
	return nil
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return aws.String(value)
}
