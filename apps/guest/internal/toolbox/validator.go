// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package toolbox

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"sync"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v5"
)

type DefaultValidator struct {
	once     sync.Once
	validate *validator.Validate
}

var _ echo.Validator = &DefaultValidator{}

type SliceValidationError []error

func (err SliceValidationError) Error() string {
	if len(err) == 0 {
		return ""
	}

	var b strings.Builder
	for i := 0; i < len(err); i++ {
		if err[i] != nil {
			if b.Len() > 0 {
				b.WriteString("\n")
			}
			b.WriteString("[" + strconv.Itoa(i) + "]: " + err[i].Error())
		}
	}
	return b.String()
}

func (v *DefaultValidator) Validate(obj any) error {
	if obj == nil {
		return nil
	}

	value := reflect.ValueOf(obj)
	switch value.Kind() {
	case reflect.Pointer:
		if value.Elem().Kind() != reflect.Struct {
			return v.Validate(value.Elem().Interface())
		}
		return v.validateStruct(obj)
	case reflect.Struct:
		return v.validateStruct(obj)
	case reflect.Slice, reflect.Array:
		count := value.Len()
		validateRet := make(SliceValidationError, 0)
		for i := 0; i < count; i++ {
			if err := v.Validate(value.Index(i).Interface()); err != nil {
				validateRet = append(validateRet, err)
			}
		}
		if len(validateRet) == 0 {
			return nil
		}
		return validateRet
	default:
		return nil
	}
}

func (v *DefaultValidator) Engine() interface{} {
	v.lazyinit()
	return v.validate
}

func (v *DefaultValidator) validateStruct(obj any) error {
	v.lazyinit()
	return v.validate.Struct(obj)
}

func (v *DefaultValidator) lazyinit() {
	v.once.Do(func() {
		v.validate = validator.New(validator.WithRequiredStructEnabled())
		v.validate.SetTagName("validate")
		if err := v.validate.RegisterValidation("optional", func(validator.FieldLevel) bool {
			return true
		}, true); err != nil {
			panic(fmt.Errorf("register optional validation: %w", err))
		}
	})
}
