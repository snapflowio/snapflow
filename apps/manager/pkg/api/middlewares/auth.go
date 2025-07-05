package middlewares

import (
	"errors"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/snapflow/manager/internal/constants"
	"github.com/snapflow/manager/pkg/common"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		authHeader := ctx.GetHeader(constants.DAYTONA_AUTHORIZATION_HEADER)
		if authHeader == "" {
			authHeader = ctx.GetHeader(constants.AUTHORIZATION_HEADER)
		}

		if authHeader == "" {
			ctx.Error(common.NewUnauthorizedError(errors.New("authorization header required")))
			ctx.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != constants.BEARER_AUTH_HEADER {
			ctx.Error(common.NewUnauthorizedError(errors.New("invalid authorization header format")))
			ctx.Abort()
			return
		}

		token := parts[1]
		if token != os.Getenv("API_TOKEN") {
			ctx.Error(common.NewUnauthorizedError(errors.New("invalid token")))
			ctx.Abort()
			return
		}

		ctx.Next()
	}
}
