package toolbox

import (
	"reflect"
	"strconv"
	"strings"
	"sync"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

type DefaultValidator struct {
	once     sync.Once
	validate *validator.Validate
}

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

func (v *DefaultValidator) Validate(i interface{}) error {
	if i == nil {
		return nil
	}

	value := reflect.ValueOf(i)
	switch value.Kind() {
	case reflect.Ptr:
		if value.Elem().Kind() != reflect.Struct {
			return v.Validate(value.Elem().Interface())
		}
		return v.validateStruct(i)
	case reflect.Struct:
		return v.validateStruct(i)
	case reflect.Slice, reflect.Array:
		count := value.Len()
		validateRet := make(SliceValidationError, 0)
		for idx := 0; idx < count; idx++ {
			if err := v.Validate(value.Index(idx).Interface()); err != nil {
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

func (v *DefaultValidator) validateStruct(obj interface{}) error {
	v.lazyinit()
	return v.validate.Struct(obj)
}

func (v *DefaultValidator) lazyinit() {
	v.once.Do(func() {
		v.validate = validator.New(validator.WithRequiredStructEnabled())
		v.validate.SetTagName("validate")
		_ = v.validate.RegisterValidation("optional", func(fl validator.FieldLevel) bool {
			return true
		}, true)
	})
}

func NewDefaultValidator() echo.Validator {
	return &DefaultValidator{}
}
