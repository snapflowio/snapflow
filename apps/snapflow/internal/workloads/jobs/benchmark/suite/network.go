// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	mathrand "math/rand/v2"
	"net/http"
	"net/url"
	"strconv"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	SpeedtestDownloadPath    = "/download"
	SpeedtestUploadPath      = "/upload"
	SpeedtestSecondsQuery    = "seconds"
	SpeedtestReceiptTrailer  = "Snapflow-Speedtest-Receipt"
	speedtestAuthorization   = "Authorization"
	speedtestBearerPrefix    = "Bearer "
	speedtestContentType     = "Content-Type"
	speedtestOctetStream     = "application/octet-stream"
	speedtestMaximumReceipt  = 64 << 10
	uploadSeedBytes          = 32
	speedtestDirectionsCount = 2
)

type SpeedtestConfig struct {
	URL      string
	Token    string
	Streams  int
	Duration time.Duration
	Client   *http.Client
}

func MeasureNetwork(ctx context.Context, cfg SpeedtestConfig) ([]*machinev1alpha1.SpeedtestReceipt, error) {
	if cfg.Client == nil || cfg.URL == "" || cfg.Token == "" || cfg.Streams <= 0 || cfg.Duration <= 0 {
		return nil, errors.New("the network benchmark needs an Edge speedtest URL, token, client, streams and duration")
	}
	receipts := make([]*machinev1alpha1.SpeedtestReceipt, 0, speedtestDirectionsCount*cfg.Streams)
	for _, transfer := range []func(context.Context, SpeedtestConfig) (*machinev1alpha1.SpeedtestReceipt, error){download, upload} {
		batch, err := parallelTransfers(ctx, cfg, transfer)
		if err != nil {
			return nil, err
		}
		receipts = append(receipts, batch...)
	}
	return receipts, nil
}

func parallelTransfers(
	ctx context.Context,
	cfg SpeedtestConfig,
	transfer func(context.Context, SpeedtestConfig) (*machinev1alpha1.SpeedtestReceipt, error),
) ([]*machinev1alpha1.SpeedtestReceipt, error) {
	receipts := make([]*machinev1alpha1.SpeedtestReceipt, cfg.Streams)
	group, groupContext := errgroup.WithContext(ctx)
	for stream := range cfg.Streams {
		group.Go(func() error {
			receipt, err := transfer(groupContext, cfg)
			receipts[stream] = receipt
			return err
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}
	return receipts, nil
}

func download(ctx context.Context, cfg SpeedtestConfig) (receipt *machinev1alpha1.SpeedtestReceipt, resultErr error) {
	target, err := url.Parse(cfg.URL + SpeedtestDownloadPath)
	if err != nil {
		return nil, fmt.Errorf("parse the Edge speedtest URL: %w", err)
	}
	target.RawQuery = url.Values{SpeedtestSecondsQuery: {strconv.Itoa(int(cfg.Duration.Seconds()))}}.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("create the speedtest download request: %w", err)
	}
	response, err := send(cfg, request)
	if err != nil {
		return nil, err
	}
	defer func() {
		resultErr = errors.Join(resultErr, closeBody(response))
	}()
	if _, err := io.Copy(io.Discard, response.Body); err != nil {
		return nil, fmt.Errorf("receive the speedtest download: %w", err)
	}
	encoded, err := base64.RawURLEncoding.DecodeString(response.Trailer.Get(SpeedtestReceiptTrailer))
	if err != nil {
		return nil, fmt.Errorf("decode the speedtest download receipt: %w", err)
	}
	return decodeReceipt(encoded)
}

func upload(ctx context.Context, cfg SpeedtestConfig) (receipt *machinev1alpha1.SpeedtestReceipt, resultErr error) {
	body, err := newTimedRandomReader(time.Now().Add(cfg.Duration))
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.URL+SpeedtestUploadPath, body)
	if err != nil {
		return nil, fmt.Errorf("create the speedtest upload request: %w", err)
	}
	request.Header.Set(speedtestContentType, speedtestOctetStream)
	response, err := send(cfg, request)
	if err != nil {
		return nil, err
	}
	defer func() {
		resultErr = errors.Join(resultErr, closeBody(response))
	}()
	encoded, err := io.ReadAll(io.LimitReader(response.Body, speedtestMaximumReceipt))
	if err != nil {
		return nil, fmt.Errorf("read the speedtest upload receipt: %w", err)
	}
	return decodeReceipt(encoded)
}

func send(cfg SpeedtestConfig, request *http.Request) (*http.Response, error) {
	request.Header.Set(speedtestAuthorization, speedtestBearerPrefix+cfg.Token)
	response, err := cfg.Client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("reach the Edge speedtest: %w", err)
	}
	if response.StatusCode != http.StatusOK {
		return nil, errors.Join(fmt.Errorf("the Edge speedtest returned HTTP %d", response.StatusCode), closeBody(response))
	}
	return response, nil
}

func closeBody(response *http.Response) error {
	if err := response.Body.Close(); err != nil {
		return fmt.Errorf("close the speedtest response: %w", err)
	}
	return nil
}

func decodeReceipt(encoded []byte) (*machinev1alpha1.SpeedtestReceipt, error) {
	receipt := &machinev1alpha1.SpeedtestReceipt{}
	if err := protojson.Unmarshal(encoded, receipt); err != nil {
		return nil, fmt.Errorf("decode the speedtest receipt: %w", err)
	}
	return receipt, nil
}

type timedRandomReader struct {
	source   *mathrand.ChaCha8
	deadline time.Time
}

func newTimedRandomReader(deadline time.Time) (*timedRandomReader, error) {
	var seed [uploadSeedBytes]byte
	if _, err := rand.Read(seed[:]); err != nil {
		return nil, fmt.Errorf("seed the speedtest upload: %w", err)
	}
	return &timedRandomReader{source: mathrand.NewChaCha8(seed), deadline: deadline}, nil
}

func (reader *timedRandomReader) Read(buffer []byte) (int, error) {
	if !time.Now().Before(reader.deadline) {
		return 0, io.EOF
	}
	return reader.source.Read(buffer)
}
