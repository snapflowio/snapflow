package dto

type CreateSandboxDTO struct {
	Id           string            `json:"id" validate:"required"`
	FromBucketId string            `json:"fromBucketId,omitempty"`
	UserId       string            `json:"userId" validate:"required"`
	Image        string            `json:"image" validate:"required"`
	OsUser       string            `json:"osUser" validate:"required"`
	CpuQuota     int64             `json:"cpuQuota" validate:"min=1"`
	GpuQuota     int64             `json:"gpuQuota" validate:"min=0"`
	MemoryQuota  int64             `json:"memoryQuota" validate:"min=1"`
	StorageQuota int64             `json:"storageQuota" validate:"min=1"`
	Env          map[string]string `json:"env,omitempty"`
	Registry     *RegistryDTO      `json:"registry,omitempty"`
	Entrypoint   []string          `json:"entrypoint,omitempty"`
	Buckets      []BucketDTO       `json:"buckets,omitempty"`
} //	@name	CreateSandboxDTO

type ResizeSandboxDTO struct {
	Cpu    int64 `json:"cpu" validate:"min=1"`
	Gpu    int64 `json:"gpu" validate:"min=0"`
	Memory int64 `json:"memory" validate:"min=1"`
} //	@name	ResizeSandboxDTO
