package api

import (
	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

type CustomValidator struct {
	validator *validator.Validate
}

func NewCustomValidator() echo.Validator {
	v := validator.New(validator.WithRequiredStructEnabled())
	v.SetTagName("validate")
	_ = v.RegisterValidation("optional", func(fl validator.FieldLevel) bool {
		return true
	}, true)

	return &CustomValidator{validator: v}
}

func (cv *CustomValidator) Validate(i interface{}) error {
	if err := cv.validator.Struct(i); err != nil {
		return err
	}
	return nil
}
