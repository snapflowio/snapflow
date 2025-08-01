// Package controllers - sandbox.go converted to Echo v4
package controllers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/snapflowio/executor/pkg/api/dto"
	"github.com/snapflowio/executor/pkg/common"
	"github.com/snapflowio/executor/pkg/executor"
	"github.com/snapflowio/executor/pkg/models/enums"
)

// Create 			godoc
//
//	@Tags			sandbox
//	@Summary		Create a sandbox
//	@Description	Create a sandbox
//	@Param			sandbox	body	dto.CreateSandboxDTO	true	"Create sandbox"
//	@Produce		json
//	@Success		201	{string}	containerId
//	@Failure		400	{object}	common.ErrorResponse
//	@Failure		401	{object}	common.ErrorResponse
//	@Failure		404	{object}	common.ErrorResponse
//	@Failure		409	{object}	common.ErrorResponse
//	@Failure		500	{object}	common.ErrorResponse
//	@Router			/sandboxes [post]
//
//	@id				Create
func Create(c echo.Context) error {
	var createSandboxDto dto.CreateSandboxDTO
	if err := c.Bind(&createSandboxDto); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	if err := c.Validate(createSandboxDto); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	exec := executor.GetInstance(nil)

	containerId, err := exec.Docker.Create(c.Request().Context(), createSandboxDto)
	if err != nil {
		exec.Cache.SetSandboxState(c.Request().Context(), createSandboxDto.Id, enums.SandboxStateError)
		common.ContainerOperationCount.WithLabelValues("create", string(common.PrometheusOperationStatusFailure)).Inc()
		return err
	}

	common.ContainerOperationCount.WithLabelValues("create", string(common.PrometheusOperationStatusSuccess)).Inc()

	return c.JSON(http.StatusCreated, containerId)
}

// Destroy 			godoc
//
//	@Tags			sandbox
//	@Summary		Destroy sandbox
//	@Description	Destroy sandbox
//	@Produce		json
//	@Param			sandboxId	path		string	true	"Sandbox ID"
//	@Success		200			{string}	string	"Sandbox destroyed"
//	@Failure		400			{object}	common.ErrorResponse
//	@Failure		401			{object}	common.ErrorResponse
//	@Failure		404			{object}	common.ErrorResponse
//	@Failure		409			{object}	common.ErrorResponse
//	@Failure		500			{object}	common.ErrorResponse
//	@Router			/sandboxes/{sandboxId}/destroy [post]
//
//	@id				Destroy
func Destroy(c echo.Context) error {
	sandboxId := c.Param("sandboxId")

	exec := executor.GetInstance(nil)

	err := exec.Docker.Destroy(c.Request().Context(), sandboxId)
	if err != nil {
		exec.Cache.SetSandboxState(c.Request().Context(), sandboxId, enums.SandboxStateError)
		common.ContainerOperationCount.WithLabelValues("destroy", string(common.PrometheusOperationStatusFailure)).Inc()
		return err
	}

	common.ContainerOperationCount.WithLabelValues("destroy", string(common.PrometheusOperationStatusSuccess)).Inc()

	return c.JSON(http.StatusOK, "Sandbox destroyed")
}

// CreateBackup godoc
//
//	@Tags			sandbox
//	@Summary		Create sandbox backup
//	@Description	Create sandbox backup
//	@Produce		json
//	@Param			sandboxId	path		string				true	"Sandbox ID"
//	@Param			sandbox		body		dto.CreateBackupDTO	true	"Create backup"
//	@Success		201			{string}	string				"Backup created"
//	@Failure		400			{object}	common.ErrorResponse
//	@Failure		401			{object}	common.ErrorResponse
//	@Failure		404			{object}	common.ErrorResponse
//	@Failure		409			{object}	common.ErrorResponse
//	@Failure		500			{object}	common.ErrorResponse
//	@Router			/sandboxes/{sandboxId}/backup [post]
//
//	@id				CreateBackup
func CreateBackup(c echo.Context) error {
	sandboxId := c.Param("sandboxId")

	var createBackupDTO dto.CreateBackupDTO
	if err := c.Bind(&createBackupDTO); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	if err := c.Validate(createBackupDTO); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	exec := executor.GetInstance(nil)

	err := exec.Docker.CreateBackup(c.Request().Context(), sandboxId, createBackupDTO)
	if err != nil {
		exec.Cache.SetBackupState(c.Request().Context(), sandboxId, enums.BackupStateFailed)
		return err
	}

	return c.JSON(http.StatusCreated, "Backup created")
}

// Resize 			godoc
//
//	@Tags			sandbox
//	@Summary		Resize sandbox
//	@Description	Resize sandbox
//	@Produce		json
//	@Param			sandboxId	path		string					true	"Sandbox ID"
//	@Param			sandbox		body		dto.ResizeSandboxDTO	true	"Resize sandbox"
//	@Success		200			{string}	string					"Sandbox resized"
//	@Failure		400			{object}	common.ErrorResponse
//	@Failure		401			{object}	common.ErrorResponse
//	@Failure		404			{object}	common.ErrorResponse
//	@Failure		409			{object}	common.ErrorResponse
//	@Failure		500			{object}	common.ErrorResponse
//	@Router			/sandboxes/{sandboxId}/resize [post]
//
//	@id				Resize
func Resize(c echo.Context) error {
	var resizeDto dto.ResizeSandboxDTO
	if err := c.Bind(&resizeDto); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	if err := c.Validate(resizeDto); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	sandboxId := c.Param("sandboxId")

	exec := executor.GetInstance(nil)

	err := exec.Docker.Resize(c.Request().Context(), sandboxId, resizeDto)
	if err != nil {
		exec.Cache.SetSandboxState(c.Request().Context(), sandboxId, enums.SandboxStateError)
		return err
	}

	return c.JSON(http.StatusOK, "Sandbox resized")
}

// Start 			godoc
//
//	@Tags			sandbox
//	@Summary		Start sandbox
//	@Description	Start sandbox
//	@Produce		json
//	@Param			sandboxId	path		string	true	"Sandbox ID"
//	@Success		200			{string}	string	"Sandbox started"
//	@Failure		400			{object}	common.ErrorResponse
//	@Failure		401			{object}	common.ErrorResponse
//	@Failure		404			{object}	common.ErrorResponse
//	@Failure		409			{object}	common.ErrorResponse
//	@Failure		500			{object}	common.ErrorResponse
//	@Router			/sandboxes/{sandboxId}/start [post]
//
//	@id				Start
func Start(c echo.Context) error {
	sandboxId := c.Param("sandboxId")

	exec := executor.GetInstance(nil)

	err := exec.Docker.Start(c.Request().Context(), sandboxId)
	if err != nil {
		exec.Cache.SetSandboxState(c.Request().Context(), sandboxId, enums.SandboxStateError)
		return err
	}

	return c.JSON(http.StatusOK, "Sandbox started")
}

// Stop 			godoc
//
//	@Tags			sandbox
//	@Summary		Stop sandbox
//	@Description	Stop sandbox
//	@Produce		json
//	@Param			sandboxId	path		string	true	"Sandbox ID"
//	@Success		200			{string}	string	"Sandbox stopped"
//	@Failure		400			{object}	common.ErrorResponse
//	@Failure		401			{object}	common.ErrorResponse
//	@Failure		404			{object}	common.ErrorResponse
//	@Failure		409			{object}	common.ErrorResponse
//	@Failure		500			{object}	common.ErrorResponse
//	@Router			/sandboxes/{sandboxId}/stop [post]
//
//	@id				Stop
func Stop(c echo.Context) error {
	sandboxId := c.Param("sandboxId")

	exec := executor.GetInstance(nil)

	err := exec.Docker.Stop(c.Request().Context(), sandboxId)
	if err != nil {
		exec.Cache.SetSandboxState(c.Request().Context(), sandboxId, enums.SandboxStateError)
		return err
	}

	return c.JSON(http.StatusOK, "Sandbox stopped")
}

// Info godoc
//
//	@Tags			sandbox
//	@Summary		Get sandbox info
//	@Description	Get sandbox info
//	@Produce		json
//	@Param			sandboxId	path		string				true	"Sandbox ID"
//	@Success		200			{object}	SandboxInfoResponse	"Sandbox info"
//	@Failure		400			{object}	common.ErrorResponse
//	@Failure		401			{object}	common.ErrorResponse
//	@Failure		404			{object}	common.ErrorResponse
//	@Failure		409			{object}	common.ErrorResponse
//	@Failure		500			{object}	common.ErrorResponse
//	@Router			/sandboxes/{sandboxId} [get]
//
//	@id				Info
func Info(c echo.Context) error {
	sandboxId := c.Param("sandboxId")

	exec := executor.GetInstance(nil)

	info := exec.SandboxService.GetSandboxStatesInfo(c.Request().Context(), sandboxId)

	return c.JSON(http.StatusOK, SandboxInfoResponse{
		State:       info.SandboxState,
		BackupState: info.BackupState,
	})
}

type SandboxInfoResponse struct {
	State       enums.SandboxState `json:"state"`
	BackupState enums.BackupState  `json:"backupState"`
} //	@name	SandboxInfoResponse

// RemoveDestroyed godoc
//
//	@Tags			sandbox
//	@Summary		Remove a destroyed sandbox
//	@Description	Remove a sandbox that has been previously destroyed
//	@Produce		json
//	@Param			sandboxId	path		string	true	"Sandbox ID"
//	@Success		200			{string}	string	"Sandbox removed"
//	@Failure		400			{object}	common.ErrorResponse
//	@Failure		401			{object}	common.ErrorResponse
//	@Failure		404			{object}	common.ErrorResponse
//	@Failure		409			{object}	common.ErrorResponse
//	@Failure		500			{object}	common.ErrorResponse
//	@Router			/sandboxes/{sandboxId} [delete]
//
//	@id				RemoveDestroyed
func RemoveDestroyed(c echo.Context) error {
	sandboxId := c.Param("sandboxId")

	exec := executor.GetInstance(nil)

	err := exec.SandboxService.RemoveDestroyedSandbox(c.Request().Context(), sandboxId)
	if err != nil {
		if !common.IsNotFoundError(err) {
			return err
		}
	}

	return c.JSON(http.StatusOK, "Sandbox removed")
}
