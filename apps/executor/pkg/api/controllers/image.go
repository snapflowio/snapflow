package controllers

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
	"github.com/snapflow/executor/cmd/executor/config"
	"github.com/snapflow/executor/pkg/api/dto"
	"github.com/snapflow/executor/pkg/common"
	"github.com/snapflow/executor/pkg/executor"
)

// PullImage godoc
//
//	@Tags			images
//	@Summary		Pull a image
//	@Description	Pull a image from a registry
//	@Param			request	body		dto.PullImageRequestDTO	true	"Pull image"
//	@Success		200		{string}	string					"Image successfully pulled"
//	@Failure		400		{object}	common.ErrorResponse
//	@Failure		401		{object}	common.ErrorResponse
//	@Failure		404		{object}	common.ErrorResponse
//	@Failure		409		{object}	common.ErrorResponse
//	@Failure		500		{object}	common.ErrorResponse
//
//	@Router			/images/pull [post]
//
//	@id				PullImage
func PullImage(c echo.Context) error {
	var request dto.PullImageRequestDTO
	if err := c.Bind(&request); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	if err := c.Validate(request); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	exec := executor.GetInstance(nil)

	err := exec.Docker.PullImage(c.Request().Context(), request.Image, request.Registry)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, "Image pulled successfully")
}

// BuildImage godoc
//
//	@Tags			images
//	@Summary		Build a image
//	@Description	Build a image from a Dockerfile and context hashes
//	@Param			request	body		dto.BuildImageRequestDTO	true	"Build image request"
//	@Success		200		{string}	string						"Image successfully built"
//	@Failure		400		{object}	common.ErrorResponse
//	@Failure		401		{object}	common.ErrorResponse
//	@Failure		404		{object}	common.ErrorResponse
//	@Failure		409		{object}	common.ErrorResponse
//	@Failure		500		{object}	common.ErrorResponse
//
//	@Router			/images/build [post]
//
//	@id				BuildImage
func BuildImage(c echo.Context) error {
	var request dto.BuildImageRequestDTO
	if err := c.Bind(&request); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	if err := c.Validate(request); err != nil {
		return common.NewInvalidBodyRequestError(err)
	}

	if !strings.Contains(request.Image, ":") || strings.HasSuffix(request.Image, ":") {
		return common.NewBadRequestError(errors.New("image name must include a valid tag"))
	}

	exec := executor.GetInstance(nil)

	err := exec.Docker.BuildImage(c.Request().Context(), request)
	if err != nil {
		return err
	}

	tag := request.Image

	if request.PushToInternalRegistry {
		if request.Registry.Project == nil {
			return common.NewBadRequestError(errors.New("project is required when pushing to internal registry"))
		}
		tag = fmt.Sprintf("%s/%s/%s", request.Registry.Url, *request.Registry.Project, request.Image)
	}

	err = exec.Docker.TagImage(c.Request().Context(), request.Image, tag)
	if err != nil {
		return err
	}

	if request.PushToInternalRegistry {
		err = exec.Docker.PushImage(c.Request().Context(), tag, request.Registry)
		if err != nil {
			return err
		}
	}

	return c.JSON(http.StatusOK, "Image built successfully")
}

// ImageExists godoc
//
//	@Tags			images
//	@Summary		Check if a image exists
//	@Description	Check if a specified image exists locally
//	@Produce		json
//	@Param			image	query		string	true	"Image name and tag"	example:"nginx:latest"
//	@Success		200		{object}	ImageExistsResponse
//	@Failure		400		{object}	common.ErrorResponse
//	@Failure		401		{object}	common.ErrorResponse
//	@Failure		404		{object}	common.ErrorResponse
//	@Failure		409		{object}	common.ErrorResponse
//	@Failure		500		{object}	common.ErrorResponse
//	@Router			/images/exists [get]
//
//	@id				ImageExists
func ImageExists(c echo.Context) error {
	image := c.QueryParam("image")
	if image == "" {
		return common.NewBadRequestError(errors.New("image parameter is required"))
	}

	exec := executor.GetInstance(nil)

	exists, err := exec.Docker.ImageExists(c.Request().Context(), image, false)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, ImageExistsResponse{
		Exists: exists,
	})
}

// RemoveImage godoc
//
//	@Tags			images
//	@Summary		Remove a image
//	@Description	Remove a specified image from the local system
//	@Produce		json
//	@Param			image	query		string	true	"Image name and tag"	example:"nginx:latest"
//	@Success		200		{string}	string	"Image successfully removed"
//	@Failure		400		{object}	common.ErrorResponse
//	@Failure		401		{object}	common.ErrorResponse
//	@Failure		404		{object}	common.ErrorResponse
//	@Failure		409		{object}	common.ErrorResponse
//	@Failure		500		{object}	common.ErrorResponse
//	@Router			/images/remove [post]
//
//	@id				RemoveImage
func RemoveImage(c echo.Context) error {
	image := c.QueryParam("image")
	if image == "" {
		return common.NewBadRequestError(errors.New("image parameter is required"))
	}

	exec := executor.GetInstance(nil)

	err := exec.Docker.RemoveImage(c.Request().Context(), image, true)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, "Image removed successfully")
}

type ImageExistsResponse struct {
	Exists bool `json:"exists" example:"true"`
} //	@name	ImageExistsResponse

// GetBuildLogs godoc
//
//	@Tags			images
//	@Summary		Get build logs
//	@Description	Stream build logs
//	@Param			imageRef	query		string	true	"Image ID or image ref without the tag"
//	@Param			follow		query		boolean	false	"Whether to follow the log output"
//	@Success		200			{string}	string	"Build logs stream"
//	@Failure		400			{object}	common.ErrorResponse
//	@Failure		401			{object}	common.ErrorResponse
//	@Failure		404			{object}	common.ErrorResponse
//	@Failure		500			{object}	common.ErrorResponse
//
//	@Router			/images/logs [get]
//
//	@id				GetBuildLogs
func GetBuildLogs(c echo.Context) error {
	imageRef := c.QueryParam("imageRef")
	if imageRef == "" {
		return common.NewBadRequestError(errors.New("imageRef parameter is required"))
	}

	follow := c.QueryParam("follow") == "true"

	logFilePath, err := config.GetBuildLogFilePath(imageRef)
	if err != nil {
		return common.NewCustomError(http.StatusInternalServerError, err.Error(), "INTERNAL_SERVER_ERROR")
	}

	if _, err := os.Stat(logFilePath); os.IsNotExist(err) {
		return common.NewNotFoundError(fmt.Errorf("build logs not found for ref: %s", imageRef))
	}

	c.Response().Header().Set("Content-Type", "application/octet-stream")

	file, err := os.Open(logFilePath)
	if err != nil {
		return common.NewCustomError(http.StatusInternalServerError, err.Error(), "INTERNAL_SERVER_ERROR")
	}
	defer file.Close()

	// If not following, just return the entire file content
	if !follow {
		_, err = io.Copy(c.Response().Writer, file)
		if err != nil {
			return common.NewCustomError(http.StatusInternalServerError, err.Error(), "INTERNAL_SERVER_ERROR")
		}
		return nil
	}

	reader := bufio.NewReader(file)
	exec := executor.GetInstance(nil)

	checkImageRef := imageRef

	// Fixed tag for instances where we are not looking for an entry with image ID
	if strings.HasPrefix(imageRef, "snapflow") {
		checkImageRef = imageRef + ":snapflow"
	}

	flusher, ok := c.Response().Writer.(http.Flusher)
	if !ok {
		return common.NewCustomError(http.StatusInternalServerError, "Streaming not supported", "STREAMING_NOT_SUPPORTED")
	}

	go func() {
		for {
			line, err := reader.ReadBytes('\n')
			if err != nil && err != io.EOF {
				log.Error().Err(err).Msg("Error reading log file")
				break
			}

			if len(line) > 0 {
				_, writeErr := c.Response().Writer.Write(line)
				if writeErr != nil {
					log.Error().Err(writeErr).Msg("Error writing to response")
					break
				}
				flusher.Flush()
			}
		}
	}()

	for {
		exists, err := exec.Docker.ImageExists(c.Request().Context(), checkImageRef, false)
		if err != nil {
			log.Error().Err(err).Msg("Error checking build status")
			break
		}

		if exists {
			time.Sleep(1 * time.Second)
			break
		}

		time.Sleep(250 * time.Millisecond)
	}

	return nil
}
