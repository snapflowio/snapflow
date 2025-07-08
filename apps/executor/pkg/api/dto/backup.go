package dto

type CreateBackupDTO struct {
	Registry RegistryDTO `json:"registry" validate:"required"`
	Snapshot string      `json:"snapshot" validate:"required"`
} //	@name	CreateBackupDTO
