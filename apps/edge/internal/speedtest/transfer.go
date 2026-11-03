// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package speedtest

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	mathrand "math/rand/v2"
	"net/http"
	"strconv"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const streamSeedBytes = 32

func secondsRangeMessage() string {
	return "seconds must be between " + strconv.Itoa(minimumSeconds) + " and " + strconv.Itoa(maximumSeconds)
}

func (handler *Handler) download(writer http.ResponseWriter, request *http.Request) {
	seconds, err := strconv.Atoi(request.URL.Query().Get(secondsQuery))
	if err != nil || seconds < minimumSeconds || seconds > maximumSeconds {
		http.Error(writer, secondsRangeMessage(), http.StatusBadRequest)
		return
	}
	admitted, ok := handler.admit(writer, request)
	if !ok {
		return
	}
	defer admitted.release()
	source, err := newStreamSource()
	if err != nil {
		http.Error(writer, "the speedtest stream is unavailable", http.StatusInternalServerError)
		return
	}
	writer.Header().Set(contentTypeHeader, octetStream)
	writer.Header().Set(trailerHeader, receiptTrailer)
	writer.WriteHeader(http.StatusOK)
	completed := handler.startTransfer(admitted.token, machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_DOWNLOAD)
	deadline := completed.startedAt.Add(time.Duration(seconds) * time.Second)
	chunk := make([]byte, transferChunkBytes)
	for request.Context().Err() == nil {
		now := handler.now()
		if !now.Before(deadline) {
			break
		}
		granted := handler.budgets.reserve(admitted.budget, len(chunk))
		if granted == 0 {
			break
		}
		if _, err := source.Read(chunk[:granted]); err != nil {
			return
		}
		written, err := writer.Write(chunk[:granted])
		handler.budgets.refund(admitted.budget, granted-written)
		completed.meter.add(written, now)
		if err != nil {
			return
		}
	}
	encoded, err := handler.signedReceipt(request.Context(), completed)
	if err != nil {
		handler.logger.Warn("speedtest download receipt failed", "error", err)
		return
	}
	writer.Header().Set(receiptTrailer, base64.RawURLEncoding.EncodeToString(encoded))
}

func (handler *Handler) upload(writer http.ResponseWriter, request *http.Request) {
	admitted, ok := handler.admit(writer, request)
	if !ok {
		return
	}
	defer admitted.release()
	completed := handler.startTransfer(admitted.token, machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_UPLOAD)
	controller := http.NewResponseController(writer)
	if err := controller.SetReadDeadline(time.Now().Add(maximumSeconds*time.Second + uploadReadGrace)); err != nil {
		http.Error(writer, "the speedtest upload cannot be bounded", http.StatusInternalServerError)
		return
	}
	counter := meteredReader{
		source: budgetedReader{source: http.MaxBytesReader(writer, request.Body, maximumUploadBytes), ledger: handler.budgets, budget: admitted.budget},
		meter:  &completed.meter,
		now:    handler.now,
	}
	_, err := io.Copy(io.Discard, counter)
	if errors.Is(err, errByteBudgetExhausted) {
		http.Error(writer, err.Error(), http.StatusRequestEntityTooLarge)
		return
	}
	if err != nil {
		http.Error(writer, "the speedtest upload did not complete", http.StatusBadRequest)
		return
	}
	encoded, err := handler.signedReceipt(request.Context(), completed)
	if err != nil {
		handler.logger.Warn("speedtest upload receipt failed", "error", err)
		http.Error(writer, "the speedtest receipt is unavailable", http.StatusInternalServerError)
		return
	}
	writer.Header().Set(contentTypeHeader, receiptMediaType)
	if _, err := writer.Write(encoded); err != nil {
		handler.logger.Debug("speedtest upload receipt was not delivered", "error", err)
	}
}

func newStreamSource() (*mathrand.ChaCha8, error) {
	var seed [streamSeedBytes]byte
	if _, err := rand.Read(seed[:]); err != nil {
		return nil, fmt.Errorf("seed the speedtest stream: %w", err)
	}
	return mathrand.NewChaCha8(seed), nil
}
