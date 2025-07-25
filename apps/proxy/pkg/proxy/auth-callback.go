package proxy

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/labstack/echo/v4"
	"golang.org/x/oauth2"

	apiclient "github.com/snapflow/apiclient"
	common_errors "github.com/snapflow/go-common/pkg/errors"
)

func (p *Proxy) AuthCallback(c echo.Context) error {
	if c.QueryParam("error") != "" {
		err := c.QueryParam("error")
		if c.QueryParam("error_description") != "" {
			err = c.QueryParam("error_description")
		}

		return common_errors.NewUnauthorizedError(errors.New(err))
	}

	code := c.QueryParam("code")
	if code == "" {
		return common_errors.NewBadRequestError(errors.New("no code in callback"))
	}

	state := c.QueryParam("state")
	if state == "" {
		return common_errors.NewBadRequestError(errors.New("no state in callback"))
	}

	stateJson, err := base64.URLEncoding.DecodeString(state)
	if err != nil {
		return common_errors.NewBadRequestError(fmt.Errorf("failed to decode state: %w", err))
	}

	var stateData map[string]string
	err = json.Unmarshal(stateJson, &stateData)
	if err != nil {
		return common_errors.NewBadRequestError(fmt.Errorf("failed to unmarshal state: %w", err))
	}

	returnTo := stateData["returnTo"]
	if returnTo == "" {
		return common_errors.NewBadRequestError(errors.New("no returnTo in state"))
	}

	sandboxId := stateData["sandboxId"]
	if sandboxId == "" {
		return common_errors.NewBadRequestError(errors.New("no sandboxId in state"))
	}

	provider, err := oidc.NewProvider(c.Request().Context(), p.config.Oidc.Domain)
	if err != nil {
		return common_errors.NewBadRequestError(fmt.Errorf("failed to initialize OIDC provider: %w", err))
	}

	oauth2Config := oauth2.Config{
		ClientID:     p.config.Oidc.ClientId,
		ClientSecret: p.config.Oidc.ClientSecret,
		RedirectURL:  fmt.Sprintf("%s://%s/callback", p.config.ProxyProtocol, c.Request().Host),
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile"},
	}

	token, err := oauth2Config.Exchange(c.Request().Context(), code)
	if err != nil {
		return common_errors.NewBadRequestError(fmt.Errorf("failed to exchange token: %w", err))
	}

	hasAccess := p.hasSandboxAccess(c.Request().Context(), sandboxId, token.AccessToken)
	if !hasAccess {
		return common_errors.NewNotFoundError(errors.New("sandbox not found"))
	}

	cookieDomain := p.config.ProxyDomain
	cookieDomain = strings.Split(cookieDomain, ":")[0]
	cookieDomain = fmt.Sprintf(".%s", cookieDomain)

	encoded, err := p.secureCookie.Encode(SNAPFLOW_SANDBOX_AUTH_COOKIE_NAME+sandboxId, sandboxId)
	if err != nil {
		return common_errors.NewBadRequestError(fmt.Errorf("failed to encode cookie: %w", err))
	}

	cookie := &http.Cookie{
		Name:     SNAPFLOW_SANDBOX_AUTH_COOKIE_NAME + sandboxId,
		Value:    encoded,
		MaxAge:   3600,
		Path:     "/",
		Domain:   cookieDomain,
		Secure:   p.config.EnableTLS,
		HttpOnly: true,
	}
	c.SetCookie(cookie)

	return c.Redirect(http.StatusFound, returnTo)
}

func (p *Proxy) getAuthUrl(c echo.Context, sandboxId string) (string, error) {
	provider, err := oidc.NewProvider(c.Request().Context(), p.config.Oidc.Domain)
	if err != nil {
		return "", fmt.Errorf("failed to initialize OIDC provider: %w", err)
	}

	oauth2Config := oauth2.Config{
		ClientID:     p.config.Oidc.ClientId,
		ClientSecret: p.config.Oidc.ClientSecret,
		RedirectURL:  fmt.Sprintf("%s://%s/callback", p.config.ProxyProtocol, p.config.ProxyDomain),
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile"},
	}

	state, err := GenerateRandomState()
	if err != nil {
		return "", fmt.Errorf("failed to generate random state: %w", err)
	}

	stateData := map[string]string{
		"state":     state,
		"returnTo":  fmt.Sprintf("%s://%s%s", p.config.ProxyProtocol, c.Request().Host, c.Request().URL.String()),
		"sandboxId": sandboxId,
	}
	stateJson, err := json.Marshal(stateData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal state: %w", err)
	}
	encodedState := base64.URLEncoding.EncodeToString(stateJson)

	authURL := oauth2Config.AuthCodeURL(
		encodedState,
	)

	return authURL, nil
}

func (p *Proxy) hasSandboxAccess(ctx context.Context, sandboxId string, authToken string) bool {
	clientConfig := apiclient.NewConfiguration()
	clientConfig.Servers = apiclient.ServerConfigurations{
		{
			URL: p.config.SnapflowApiUrl,
		},
	}

	clientConfig.AddDefaultHeader("Authorization", "Bearer "+authToken)

	apiClient := apiclient.NewAPIClient(clientConfig)

	res, _ := apiClient.PreviewAPI.HasSandboxAccess(ctx, sandboxId).Execute()

	return res != nil
}

func GenerateRandomState() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(b), nil
}
