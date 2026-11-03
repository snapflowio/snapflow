// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package speedtest

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const (
	downloadPath              = "/download"
	uploadPath                = "/upload"
	secondsQuery              = "seconds"
	receiptTrailer            = "Snapflow-Speedtest-Receipt"
	authorizationHeader       = "Authorization"
	bearerPrefix              = "Bearer "
	contentTypeHeader         = "Content-Type"
	cacheControlHeader        = "Cache-Control"
	trailerHeader             = "Trailer"
	octetStream               = "application/octet-stream"
	receiptMediaType          = "application/json"
	noStore                   = "no-store"
	minimumSeconds            = 1
	maximumSeconds            = 30
	rampDuration              = 3 * time.Second
	uploadReadGrace           = 5 * time.Second
	maximumUploadBytes        = 64 << 30
	maximumTransfers          = 32
	maximumBenchmarkTransfers = 8
	transferChunkBytes        = 64 << 10
)

type Signer interface {
	KeyID() string
	Sign(payload []byte) (string, error)
}

type Handler struct {
	logger    *slog.Logger
	signer    Signer
	keys      *keyring
	budgets   *budgetLedger
	now       func() time.Time
	transfers chan struct{}
	mux       *http.ServeMux
}

type admission struct {
	token   string
	budget  *benchmarkBudget
	release func()
}

func New(signer Signer, keys KeySource, opts ...Option) (*Handler, error) {
	configured := newOptions(opts)
	if signer == nil {
		return nil, errors.New("the Edge speedtest needs the Edge identity signer")
	}
	if keys == nil {
		return nil, errors.New("the Edge speedtest needs the speedtest token key source")
	}
	handler := &Handler{
		signer:    signer,
		budgets:   newBudgetLedger(),
		now:       configured.now,
		logger:    configured.logger,
		transfers: make(chan struct{}, maximumTransfers),
		mux:       http.NewServeMux(),
	}
	handler.keys = &keyring{source: keys, now: handler.now}
	handler.mux.HandleFunc(http.MethodGet+" "+downloadPath, handler.download)
	handler.mux.HandleFunc(http.MethodPost+" "+uploadPath, handler.upload)
	return handler, nil
}

func (handler *Handler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set(cacheControlHeader, noStore)
	handler.mux.ServeHTTP(writer, request)
}

func (handler *Handler) admit(writer http.ResponseWriter, request *http.Request) (admission, bool) {
	token, found := strings.CutPrefix(request.Header.Get(authorizationHeader), bearerPrefix)
	if !found {
		http.Error(writer, "a valid speedtest token is required", http.StatusUnauthorized)
		return admission{}, false
	}
	claims, err := handler.verifyToken(request.Context(), token)
	if errors.Is(err, errKeysUnavailable) {
		handler.logger.Warn("speedtest token keys are unavailable", "error", err)
		http.Error(writer, "the speedtest cannot verify tokens right now", http.StatusServiceUnavailable)
		return admission{}, false
	}
	if err != nil {
		http.Error(writer, "a valid speedtest token is required", http.StatusUnauthorized)
		return admission{}, false
	}
	select {
	case handler.transfers <- struct{}{}:
	default:
		http.Error(writer, "the speedtest is busy", http.StatusServiceUnavailable)
		return admission{}, false
	}
	budget, opened := handler.budgets.open(claims, handler.now())
	if !opened {
		<-handler.transfers
		http.Error(writer, "too many transfers for this benchmark", http.StatusTooManyRequests)
		return admission{}, false
	}
	return admission{token: token, budget: budget, release: func() {
		handler.budgets.close(budget)
		<-handler.transfers
	}}, true
}
