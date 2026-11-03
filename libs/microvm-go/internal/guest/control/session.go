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

package control

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/snapflowio/microvm-go/guest"
)

const (
	guestSessionLifetime = 15 * time.Minute
	maximumGuestSessions = 32
)

type guestSession struct {
	response SessionResponse
	expires  time.Time
}

func newGuestEphemeralKey() (ed25519.PublicKey, ed25519.PrivateKey, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate guest session key: %w", err)
	}
	return publicKey, privateKey, nil
}

func (s *Server) createSession(c *echo.Context) error {
	var request SessionRequest
	if err := decodeBoundedJSON(c, &request, maxSessionRequestBytes); err != nil {
		return writeProblem(c, http.StatusBadRequest, "GUEST_SESSION_REQUEST_INVALID", "Guest session request is invalid", false, nil)
	}
	response, err := s.issueSession(request)
	if err != nil {
		return writeControlError(c, err, nil)
	}
	return c.JSON(http.StatusOK, response)
}

func validateSessionRequest(request SessionRequest) error {
	if request.MinimumProtocolVersion != ProtocolVersion ||
		request.MaximumProtocolVersion != ProtocolVersion ||
		!slices.Equal(request.Features, ProtocolFeatures()) ||
		uuid.Validate(request.HostSessionID) != nil {
		return &guest.ControlProblem{Status: http.StatusBadRequest, Code: "GUEST_PROTOCOL_INCOMPATIBLE", Message: "Guest protocol version or features are incompatible"}
	}
	return nil
}

func (s *Server) issueSession(request SessionRequest) (SessionResponse, error) {
	if err := validateSessionRequest(request); err != nil {
		return SessionResponse{}, err
	}
	bootID, err := readGuestBootID()
	if err != nil {
		return SessionResponse{}, err
	}
	configIdentity := s.config.Snapshot()
	now := time.Now().UTC()
	s.sessionMu.Lock()
	defer s.sessionMu.Unlock()
	identity := SessionIdentity{
		ProtocolVersion: ProtocolVersion,
		Features:        ProtocolFeatures(),
		BuildDigest:     s.buildDigest,
		BootID:          bootID,
		InstanceID:      configIdentity.InstanceID,
		GenerationID:    configIdentity.GenerationID,
		HostSessionID:   request.HostSessionID,
		GuestSessionID:  uuid.NewString(),
		GuestPublicKey:  base64.RawURLEncoding.EncodeToString(s.guestPublicKey),
		GuestKeyID:      guestKeyID(s.guestPublicKey),
		ExpiresAt:       now.Add(guestSessionLifetime).Format(time.RFC3339Nano),
	}
	message, err := guestSessionSigningMessage(identity)
	if err != nil {
		return SessionResponse{}, err
	}
	response := SessionResponse{
		SessionIdentity: identity,
		Algorithm:       GuestSessionSignatureAlgorithm,
		Signature:       base64.RawURLEncoding.EncodeToString(ed25519.Sign(s.guestPrivateKey, message)),
	}
	for id, session := range s.guestSessions {
		if !session.expires.After(now) {
			delete(s.guestSessions, id)
			continue
		}
		if session.response.HostSessionID == request.HostSessionID &&
			session.response.InstanceID == configIdentity.InstanceID &&
			session.response.GenerationID == configIdentity.GenerationID &&
			session.response.GuestKeyID == guestKeyID(s.guestPublicKey) {
			return session.response, nil
		}
	}
	if len(s.guestSessions) >= maximumGuestSessions {
		return SessionResponse{}, &guest.ControlProblem{
			Status: http.StatusServiceUnavailable, Code: "GUEST_SESSION_CAPACITY_EXCEEDED",
			Message: "Guest session capacity is temporarily exhausted", Retryable: true, Details: retryAfterDetails(),
		}
	}
	s.guestSessions[response.GuestSessionID] = guestSession{response: response, expires: now.Add(guestSessionLifetime)}
	return response, nil
}

func (s *Server) requireSession(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		if c.Path() == "" || c.Path() == SessionPath || c.Path() == RestorePath {
			return next(c)
		}
		guestSessionID := c.Request().Header.Get(GuestSessionHeader)
		hostSessionID := c.Request().Header.Get(GuestHostSessionHeader)
		s.sessionMu.Lock()
		session, exists := s.guestSessions[guestSessionID]
		activeGuestKeyID := guestKeyID(s.guestPublicKey)
		if exists && !session.expires.After(time.Now()) {
			delete(s.guestSessions, guestSessionID)
			exists = false
		}
		s.sessionMu.Unlock()
		identity := s.config.Snapshot()
		if !exists || session.response.HostSessionID != hostSessionID ||
			session.response.GuestKeyID != activeGuestKeyID ||
			session.response.InstanceID != identity.InstanceID ||
			session.response.GenerationID != identity.GenerationID {
			return writeProblem(c, http.StatusUnauthorized, "GUEST_SESSION_INVALID", "Guest session is missing, expired, or no longer bound to this guest identity", false, nil)
		}
		return next(c)
	}
}

func readGuestBootID() (string, error) {
	data, err := os.ReadFile("/proc/sys/kernel/random/boot_id")
	if err != nil {
		return "", fmt.Errorf("read guest boot ID: %w", err)
	}
	bootID := strings.TrimSpace(string(data))
	if uuid.Validate(bootID) != nil {
		return "", fmt.Errorf("guest boot ID is invalid")
	}
	return bootID, nil
}

func executableDigest() (string, error) {
	data, err := os.ReadFile("/proc/self/exe")
	if err != nil {
		return "", fmt.Errorf("read guest init executable: %w", err)
	}
	digest := sha256.Sum256(data)
	return "sha256:" + hex.EncodeToString(digest[:]), nil
}

func guestKeyID(publicKey ed25519.PublicKey) string {
	digest := sha256.Sum256(publicKey)
	return "ed25519:" + hex.EncodeToString(digest[:16])
}

func VerifyGuestSessionResponse(response SessionResponse) error {
	if response.Algorithm != GuestSessionSignatureAlgorithm {
		return fmt.Errorf("guest session signature algorithm is unsupported")
	}
	publicKey, err := base64.RawURLEncoding.DecodeString(response.GuestPublicKey)
	if err != nil || len(publicKey) != ed25519.PublicKeySize {
		return fmt.Errorf("guest session public key is invalid")
	}
	if response.GuestKeyID != guestKeyID(ed25519.PublicKey(publicKey)) {
		return fmt.Errorf("guest session key identifier does not match its public key")
	}
	signature, err := base64.RawURLEncoding.DecodeString(response.Signature)
	if err != nil || len(signature) != ed25519.SignatureSize {
		return fmt.Errorf("guest session signature is invalid")
	}
	message, err := guestSessionSigningMessage(response.SessionIdentity)
	if err != nil {
		return err
	}
	if !ed25519.Verify(ed25519.PublicKey(publicKey), message, signature) {
		return fmt.Errorf("guest session signature verification failed")
	}
	return nil
}

func guestSessionSigningMessage(identity SessionIdentity) ([]byte, error) {
	payload, err := json.Marshal(identity)
	if err != nil {
		return nil, fmt.Errorf("encode guest session identity: %w", err)
	}
	digest := sha256.Sum256(payload)
	return []byte(fmt.Sprintf(
		"%s.%s.sha256:%s",
		GuestSessionSignatureAlgorithm,
		GuestSessionSignatureDomain,
		hex.EncodeToString(digest[:]),
	)), nil
}
