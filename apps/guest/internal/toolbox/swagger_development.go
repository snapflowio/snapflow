// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build development

package toolbox

import (
	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/toolbox/docs"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

const swaggerRoute = "/swagger/*"

func registerSwagger(router *echo.Echo) {
	router.GET(swaggerRoute, echo.WrapHandler(httpSwagger.Handler(httpSwagger.InstanceName(docs.SwaggerInfo.InstanceName()))))
}
