package proxy

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
)

func (p *Proxy) Authenticate(c echo.Context, sandboxId string) (err error, didRedirect bool) {
	authKey := c.Request().Header.Get(SNAPFLOW_SANDBOX_AUTH_KEY_HEADER)
	if authKey == "" {
		if c.QueryParam(SNAPFLOW_SANDBOX_AUTH_KEY_QUERY_PARAM) != "" {
			authKey = c.QueryParam(SNAPFLOW_SANDBOX_AUTH_KEY_QUERY_PARAM)
			newQuery := c.Request().URL.Query()
			newQuery.Del(SNAPFLOW_SANDBOX_AUTH_KEY_QUERY_PARAM)
			c.Request().URL.RawQuery = newQuery.Encode()
		} else {
			cookie, err := c.Cookie(SNAPFLOW_SANDBOX_AUTH_COOKIE_NAME + sandboxId)
			if err == nil && cookie != nil {
				decodedValue := ""
				err = p.secureCookie.Decode(SNAPFLOW_SANDBOX_AUTH_COOKIE_NAME+sandboxId, cookie.Value, &decodedValue)
				if err != nil {
					return errors.New("sandbox not found"), false
				}

				if decodedValue != sandboxId {
					return errors.New("sandbox not found"), false
				} else {
					return nil, false
				}
			} else {
				authUrl, err := p.getAuthUrl(c, sandboxId)
				if err != nil {
					return fmt.Errorf("failed to get auth URL: %w", err), false
				}

				c.Redirect(http.StatusTemporaryRedirect, authUrl)

				return errors.New("auth key is required"), true
			}
		}
	}

	if authKey != "" {
		isValid, err := p.getSandboxAuthKeyValid(c.Request().Context(), sandboxId, authKey)
		if err != nil {
			return fmt.Errorf("failed to get sandbox auth key valid status: %w", err), false
		}

		if !*isValid {
			return errors.New("invalid auth key"), false
		} else {
			return nil, false
		}
	}

	return errors.New("auth key is required. Authenticate via a Header, Query Param or Cookie"), false
}
