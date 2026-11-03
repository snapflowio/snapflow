// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"crypto/ed25519"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/snapflowio/common-go/pkg/useragent"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	SnapflowSourceHeader = "X-Snapflow-Source"
	MachineTokenType     = "DPoP"
	machineSource        = "machine"
	userAgentProduct     = "snapflow"
	defaultAPIBasePath   = "/api"
	schemeHTTP           = "http"
	schemeHTTPS          = "https"
)

type MachineIdentity struct {
	MachineID  string
	KeyID      string
	SigningKey ed25519.PrivateKey
}

func (identity MachineIdentity) validate() error {
	if strings.TrimSpace(identity.MachineID) == "" || strings.TrimSpace(identity.KeyID) == "" {
		return errors.New("machine ID and key ID are required")
	}
	if len(identity.SigningKey) != ed25519.PrivateKeySize {
		return errors.New("machine Ed25519 signing key is required")
	}
	return nil
}

type Client struct {
	*apiclient.ClientWithResponses
	proof *proofTransport
}

type Config struct {
	ServerURL string
	Identity  MachineIdentity
}

func New(cfg Config, opts ...Option) (*Client, error) {
	normalizedServerURL, err := normalizeServerURL(cfg.ServerURL)
	if err != nil {
		return nil, err
	}
	if err := cfg.Identity.validate(); err != nil {
		return nil, err
	}
	transport := newProofTransport(
		newOptions(opts).transport,
		cfg.Identity.SigningKey,
	)
	api, err := newAPIClient(normalizedServerURL, &http.Client{Transport: transport}, setSourceHeader)
	if err != nil {
		return nil, err
	}
	return &Client{ClientWithResponses: api, proof: transport}, nil
}

func newAPIClient(
	serverURL string,
	httpClient *http.Client,
	editors ...apiclient.RequestEditorFn,
) (*apiclient.ClientWithResponses, error) {
	options := []apiclient.ClientOption{
		apiclient.WithHTTPClient(httpClient),
		apiclient.WithRequestEditorFn(useragent.RequestEditor(userAgentProduct)),
	}
	for _, editor := range editors {
		options = append(options, apiclient.WithRequestEditorFn(editor))
	}
	api, err := apiclient.NewClientWithResponses(serverURL, options...)
	if err != nil {
		return nil, fmt.Errorf("create control-plane API client: %w", err)
	}
	return api, nil
}

func setSourceHeader(ctx context.Context, request *http.Request) error {
	request.Header.Set(SnapflowSourceHeader, machineSource)
	return ctx.Err()
}

func NewForIdentity(identity *state.Identity, opts ...Option) (*Client, error) {
	if identity == nil {
		return nil, errors.New("registered machine identity is required")
	}
	return New(Config{ServerURL: identity.APIURL, Identity: MachineIdentity{
		MachineID: identity.MachineID, KeyID: identity.KeyID, SigningKey: identity.SigningKey,
	}}, opts...)
}

func (client *Client) ActivateSession(token string) error {
	return client.proof.setSessionToken(token)
}

func (client *Client) ClearSession() {
	client.proof.clearSessionToken()
}

func normalizeServerURL(serverURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(serverURL))
	if err != nil || (parsed.Scheme != schemeHTTP && parsed.Scheme != schemeHTTPS) || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("the Snapflow API URL must be an absolute HTTP(S) URL without credentials, query, or fragment")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawPath = ""
	if parsed.Path == "" {
		parsed.Path = defaultAPIBasePath
	}
	return parsed.String(), nil
}
