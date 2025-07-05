package dto

type RegistryDTO struct {
	Url      string  `json:"url" validate:"required"`
	Project  *string `json:"project" validate:"optional"`
	Username string  `json:"username" validate:"required"`
	Password string  `json:"password" validate:"required"`
} //	@name	RegistryDTO
