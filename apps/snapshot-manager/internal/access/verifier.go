// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/time/rate"
)

const (
	clockSkewLeeway        = 30 * time.Second
	keySetRefreshInterval  = 10 * time.Minute
	unknownKeyRefreshEvery = time.Minute
	keySetRequestTimeout   = 10 * time.Second
)

// VerifierConfig points the verifier at the api's registry token key set.
type VerifierConfig struct {
	JWKSURL        string
	DeniedSubjects []string
	Logger         *slog.Logger
}

// Verifier checks registry tokens offline against a cached JWKS that refreshes
// periodically and whenever a token names an unknown key id.
type Verifier struct {
	keys   jwt.Keyfunc
	denied map[string]struct{}
	now    func() time.Time
}

// NewVerifier starts the key set refresh, which runs until ctx ends. An
// unreachable key set does not fail startup; tokens are refused until it loads.
func NewVerifier(ctx context.Context, cfg VerifierConfig) (*Verifier, error) {
	if cfg.JWKSURL == "" {
		return nil, ErrJWKSURLRequired
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	keys, err := keyfunc.NewDefaultOverrideCtx(ctx, []string{cfg.JWKSURL}, keyfunc.Override{
		HTTPTimeout:       keySetRequestTimeout,
		RefreshInterval:   keySetRefreshInterval,
		RefreshUnknownKID: rate.NewLimiter(rate.Every(unknownKeyRefreshEvery), 1),
		RefreshErrorHandlerFunc: func(url string) func(context.Context, error) {
			return func(ctx context.Context, err error) {
				logger.WarnContext(ctx, "Failed to refresh registry token keys", "url", url, "error", err)
			}
		},
	})
	if err != nil {
		return nil, fmt.Errorf("load registry token keys: %w", err)
	}
	return newVerifier(keys.Keyfunc, cfg.DeniedSubjects, time.Now), nil
}

func newVerifier(keys jwt.Keyfunc, deniedSubjects []string, now func() time.Time) *Verifier {
	denied := make(map[string]struct{}, len(deniedSubjects))
	for _, subject := range deniedSubjects {
		denied[subject] = struct{}{}
	}
	return &Verifier{keys: keys, denied: denied, now: now}
}

func (verifier *Verifier) verify(token string) (*tokenClaims, error) {
	claims := &tokenClaims{}
	parsed, err := jwt.ParseWithClaims(
		token,
		claims,
		verifier.keys,
		jwt.WithValidMethods([]string{tokenAlgorithm}),
		jwt.WithIssuer(tokenIssuer),
		jwt.WithAudience(tokenAudience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(clockSkewLeeway),
		jwt.WithTimeFunc(verifier.now),
	)
	if err != nil {
		return nil, errors.Join(ErrInvalidToken, err)
	}
	if !parsed.Valid {
		return nil, ErrInvalidToken
	}
	if claims.Subject == "" {
		return nil, ErrSubjectRequired
	}
	if claims.ID == "" {
		return nil, ErrTokenIDRequired
	}
	if _, denied := verifier.denied[claims.Subject]; denied {
		return nil, fmt.Errorf("%w: %s", ErrSubjectDenied, claims.Subject)
	}
	return claims, nil
}
