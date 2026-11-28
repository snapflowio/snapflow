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
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"golang.org/x/sync/errgroup"
)

const (
	partsInFlight = 4
	abortTimeout  = time.Minute
)

func (upload objectUpload) multipart(ctx context.Context, partSize int64) error {
	created, err := upload.client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket:      aws.String(upload.target.Bucket),
		Key:         aws.String(upload.target.Key),
		ContentType: optionalString(upload.target.ContentType),
	})
	if err != nil {
		return fmt.Errorf("start multipart upload of %s: %w", upload.target.Key, err)
	}
	parts, err := upload.parts(ctx, created.UploadId, partSize)
	if err == nil {
		_, err = upload.client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
			Bucket:          aws.String(upload.target.Bucket),
			Key:             aws.String(upload.target.Key),
			UploadId:        created.UploadId,
			MultipartUpload: &s3types.CompletedMultipartUpload{Parts: parts},
		})
		if err == nil {
			return nil
		}
		err = fmt.Errorf("complete multipart upload of %s: %w", upload.target.Key, err)
	}
	return errors.Join(err, upload.abort(ctx, created.UploadId))
}

func (upload objectUpload) parts(ctx context.Context, uploadID *string, partSize int64) ([]s3types.CompletedPart, error) {
	partCount := ceilDiv(upload.size, partSize)
	completed := make([]s3types.CompletedPart, partCount)
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(partsInFlight)
	for index := range partCount {
		if groupCtx.Err() != nil {
			break
		}
		group.Go(func() error {
			offset := index * partSize
			length := min(partSize, upload.size-offset)
			number := aws.Int32(int32(index + 1))
			output, err := upload.client.UploadPart(groupCtx, &s3.UploadPartInput{
				Bucket:        aws.String(upload.target.Bucket),
				Key:           aws.String(upload.target.Key),
				UploadId:      uploadID,
				PartNumber:    number,
				ContentLength: aws.Int64(length),
				Body:          io.NewSectionReader(upload.file, offset, length),
			})
			if err != nil {
				return fmt.Errorf("upload part %d of %s: %w", *number, upload.target.Key, err)
			}
			completed[index] = s3types.CompletedPart{ETag: output.ETag, PartNumber: number}
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("upload parts of %s: %w", upload.target.Key, err)
	}
	return completed, nil
}

func (upload objectUpload) abort(ctx context.Context, uploadID *string) error {
	abortCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), abortTimeout)
	defer cancel()
	_, err := upload.client.AbortMultipartUpload(abortCtx, &s3.AbortMultipartUploadInput{
		Bucket:   aws.String(upload.target.Bucket),
		Key:      aws.String(upload.target.Key),
		UploadId: uploadID,
	})
	if err != nil {
		return fmt.Errorf("abort multipart upload of %s: %w", upload.target.Key, err)
	}
	return nil
}
