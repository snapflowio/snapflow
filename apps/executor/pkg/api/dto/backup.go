package dto

type CreateBackupDTO struct {
	Registry RegistryDTO `json:"registry" validate:"required"`
	Image    string      `json:"image" validate:"required"`
} //	@name	CreateBackupDTO
