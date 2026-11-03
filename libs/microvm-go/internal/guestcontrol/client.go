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

package guestcontrol

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/internal/guest/control"
	"github.com/snapflowio/microvm-go/internal/socketdial"
	"github.com/snapflowio/microvm-go/internal/vsock"
)

const hostSessionUUIDVersion = 8

const (
	requestTimeout            = 15 * time.Second
	idleConnections           = 1
	maxControlResponseBytes   = 64 * 1024
	hostSessionIdentityDomain = "snapflow.guest-control.host-session.v1"
)

type Client struct {
	http          *http.Client
	transport     *http.Transport
	vsockSocket   string
	token         string
	hostSessionID string
	sessionMu     sync.Mutex
	session       *control.SessionResponse
}

func NewClient(vsockSocket, token string) (*Client, error) {
	if vsockSocket == "" {
		return nil, fmt.Errorf("instance control vsock path is required")
	}
	if token == "" {
		return nil, fmt.Errorf("instance control credential is required")
	}
	transport := socketdial.HTTPTransport(vsock.Endpoint(vsockSocket, control.Port))
	transport.DisableKeepAlives = false
	transport.MaxIdleConns = idleConnections
	transport.MaxIdleConnsPerHost = idleConnections
	transport.IdleConnTimeout = requestTimeout
	return &Client{
		http:          &http.Client{Transport: transport, Timeout: requestTimeout},
		transport:     transport,
		vsockSocket:   vsockSocket,
		token:         token,
		hostSessionID: stableHostSessionID(token),
	}, nil
}

func stableHostSessionID(token string) string {
	return uuid.NewHash(
		sha256.New(),
		uuid.NameSpaceOID,
		[]byte(hostSessionIdentityDomain+"\x00"+token),
		hostSessionUUIDVersion,
	).String()
}

func (c *Client) Close() {
	c.transport.CloseIdleConnections()
}

func (c *Client) ExecHealth(ctx context.Context, request control.ExecHealthRequest) (control.ExecHealthResponse, error) {
	var response control.ExecHealthResponse
	if err := c.send(ctx, http.MethodPost, control.HealthExecPath, request, &response, false); err != nil {
		return control.ExecHealthResponse{}, err
	}
	return response, nil
}

func (c *Client) PrepareFork(ctx context.Context) error {
	return c.post(ctx, control.ForkPreparePath, nil)
}

func (c *Client) Session(ctx context.Context) (control.SessionResponse, error) {
	if err := c.ensureSession(ctx); err != nil {
		return control.SessionResponse{}, err
	}
	return *c.session, nil
}

func (c *Client) Ready(ctx context.Context) error {
	return c.request(ctx, http.MethodGet, control.ReadyPath, nil)
}

func (c *Client) WorkloadReady(ctx context.Context) error {
	return c.request(ctx, http.MethodGet, control.WorkloadReadyPath, nil)
}

func (c *Client) ResumeAfterFork(ctx context.Context) error {
	return c.post(ctx, control.ForkResumePath, nil)
}

func (c *Client) Restore(ctx context.Context, identity control.RestoredIdentity, workload *control.InitializeWorkloadRequest) (*Client, error) {
	restored, err := NewClient(c.vsockSocket, identity.ControlAuthToken)
	if err != nil {
		return nil, err
	}
	request := control.RestoreRequest{Identity: identity, Workload: workload, Session: restored.sessionRequest()}
	if err := request.Validate(); err != nil {
		return nil, fmt.Errorf("validate restore request: %w", err)
	}
	var response control.RestoreResponse
	if err := c.send(ctx, http.MethodPost, control.RestorePath, request, &response, false); err != nil {
		return nil, err
	}
	if err := restored.adoptSession(response.Session); err != nil {
		return nil, fmt.Errorf("adopt restored guest session: %w", err)
	}
	if response.Session.InstanceID != identity.InstanceID || response.Session.GenerationID != identity.GenerationID {
		return nil, fmt.Errorf("restored guest session is not bound to the restored identity")
	}
	return restored, nil
}

func (c *Client) ApplySecrets(ctx context.Context, values map[string]string) error {
	request := control.ApplySecretsRequest{Values: values}
	if err := request.Validate(); err != nil {
		return fmt.Errorf("validate secret environment: %w", err)
	}
	return c.post(ctx, control.SecretsApplyPath, request)
}

func (c *Client) ApplyHosts(ctx context.Context, entries []control.HostEntry) error {
	return c.post(ctx, control.HostsApplyPath, control.ApplyHostsRequest{Entries: entries})
}

func (c *Client) FreezeVolumes(ctx context.Context, mountPaths []string) error {
	request := control.FreezeVolumesRequest{MountPaths: mountPaths}
	if err := request.Validate(); err != nil {
		return fmt.Errorf("validate volume freeze: %w", err)
	}
	return c.post(ctx, control.VolumesFreezePath, request)
}

func (c *Client) ThawVolumes(ctx context.Context) error {
	return c.post(ctx, control.VolumesThawPath, nil)
}

func (c *Client) Telemetry(ctx context.Context) (control.TelemetrySnapshot, error) {
	var snapshot control.TelemetrySnapshot
	if err := c.get(ctx, control.TelemetryPath, &snapshot); err != nil {
		return control.TelemetrySnapshot{}, err
	}
	return snapshot, nil
}

func (c *Client) get(ctx context.Context, path string, destination any) error {
	return c.requestAndDecode(ctx, http.MethodGet, path, nil, destination)
}

func (c *Client) post(ctx context.Context, path string, body any) error {
	return c.request(ctx, http.MethodPost, path, body)
}

func (c *Client) request(ctx context.Context, method, path string, body any) error {
	return c.requestAndDecode(ctx, method, path, body, nil)
}

func (c *Client) requestAndDecode(ctx context.Context, method, path string, body, destination any) error {
	if err := c.ensureSession(ctx); err != nil {
		return err
	}
	return c.send(ctx, method, path, body, destination, true)
}

func (c *Client) ensureSession(ctx context.Context) error {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	if c.session != nil {
		expiresAt, err := time.Parse(time.RFC3339Nano, c.session.ExpiresAt)
		if err == nil && time.Until(expiresAt) > requestTimeout {
			return nil
		}
		c.session = nil
	}
	var response control.SessionResponse
	if err := c.send(ctx, http.MethodPost, control.SessionPath, c.sessionRequest(), &response, false); err != nil {
		return fmt.Errorf("negotiate guest control protocol: %w", err)
	}
	return c.verifySession(response)
}

func (c *Client) sessionRequest() control.SessionRequest {
	return control.SessionRequest{
		MinimumProtocolVersion: control.ProtocolVersion,
		MaximumProtocolVersion: control.ProtocolVersion,
		Features:               control.ProtocolFeatures(),
		HostSessionID:          c.hostSessionID,
	}
}

func (c *Client) adoptSession(response control.SessionResponse) error {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	return c.verifySession(response)
}

func (c *Client) verifySession(response control.SessionResponse) error {
	if response.ProtocolVersion != control.ProtocolVersion ||
		!slices.Equal(response.Features, control.ProtocolFeatures()) ||
		response.HostSessionID != c.hostSessionID ||
		uuid.Validate(response.GuestSessionID) != nil ||
		response.BuildDigest == "" || response.BootID == "" ||
		response.InstanceID == "" || response.GenerationID == "" ||
		response.GuestPublicKey == "" || response.GuestKeyID == "" {
		return fmt.Errorf("guest control negotiation returned an invalid identity-bound session")
	}
	if err := control.VerifyGuestSessionResponse(response); err != nil {
		return fmt.Errorf("authenticate guest control session: %w", err)
	}
	c.session = &response
	return nil
}

func (c *Client) send(ctx context.Context, method, path string, body, destination any, authenticatedSession bool) error {
	request, err := c.newRequest(ctx, method, path, body, authenticatedSession)
	if err != nil {
		return err
	}
	response, err := c.http.Do(request)
	if err != nil {
		return fmt.Errorf("send instance control request %s: %w", path, err)
	}
	data, err := readControlResponse(response, path)
	if err != nil {
		return err
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return controlProblem(data, path, response.StatusCode)
	}
	if destination != nil {
		if err := json.Unmarshal(data, destination); err != nil {
			return fmt.Errorf("decode instance control response %s: %w", path, err)
		}
	}
	return nil
}

func (c *Client) newRequest(ctx context.Context, method, path string, body any, authenticatedSession bool) (*http.Request, error) {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("encode instance control request: %w", err)
		}
		reader = bytes.NewReader(data)
	}
	request, err := http.NewRequestWithContext(ctx, method, "http://instance-control.internal"+path, reader)
	if err != nil {
		return nil, fmt.Errorf("create instance control request: %w", err)
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	request.Header.Set(control.ControlTokenHeader, c.token)
	if authenticatedSession {
		if c.session == nil {
			return nil, fmt.Errorf("guest control session is not negotiated")
		}
		request.Header.Set(control.GuestSessionHeader, c.session.GuestSessionID)
		request.Header.Set(control.GuestHostSessionHeader, c.hostSessionID)
	}
	return request, nil
}

func readControlResponse(response *http.Response, path string) ([]byte, error) {
	data, readErr := io.ReadAll(io.LimitReader(response.Body, maxControlResponseBytes+1))
	closeErr := response.Body.Close()
	if readErr != nil {
		return nil, fmt.Errorf("read instance control response %s: %w", path, readErr)
	}
	if closeErr != nil {
		return nil, fmt.Errorf("close instance control response %s: %w", path, closeErr)
	}
	if len(data) > maxControlResponseBytes {
		return nil, fmt.Errorf(
			"instance control response %s exceeds %d byte limit",
			path,
			maxControlResponseBytes,
		)
	}
	return data, nil
}

func controlProblem(data []byte, path string, status int) error {
	var problem control.Problem
	if err := json.Unmarshal(data, &problem); err != nil || problem.Code == "" || problem.Message == "" {
		return fmt.Errorf("instance control request %s returned %d with an invalid problem response", path, status)
	}
	return &guest.ControlProblem{
		Code: problem.Code, Message: problem.Message, Retryable: problem.Retryable,
		Status: status, Details: problem.Details,
	}
}
