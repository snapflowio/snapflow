# CreateSandbox

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Image** | Pointer to **string** | The ID or name of the image used for the sandbox | [optional] 
**User** | Pointer to **string** | The user associated with the project | [optional] 
**Env** | Pointer to **map[string]string** | Environment variables for the sandbox | [optional] 
**Labels** | Pointer to **map[string]string** | Labels for the sandbox | [optional] 
**Public** | Pointer to **bool** | Whether the sandbox http preview is publicly accessible | [optional] 
**Class** | Pointer to **string** | The sandbox class type | [optional] 
**Target** | Pointer to **string** | The target (region) where the sandbox will be created | [optional] 
**Cpu** | Pointer to **int32** | CPU cores allocated to the sandbox | [optional] 
**Gpu** | Pointer to **int32** | GPU units allocated to the sandbox | [optional] 
**Memory** | Pointer to **int32** | Memory allocated to the sandbox in GB | [optional] 
**Disk** | Pointer to **int32** | Disk space allocated to the sandbox in GB | [optional] 
**AutoStopInterval** | Pointer to **int32** | Auto-stop interval in minutes (0 means disabled) | [optional] 
**AutoArchiveInterval** | Pointer to **int32** | Auto-archive interval in minutes (0 means the maximum interval will be used) | [optional] 
**Buckets** | Pointer to [**[]SandboxBucket**](SandboxBucket.md) | Array of buckets to attach to the sandbox | [optional] 
**BuildInfo** | Pointer to [**CreateBuildInfo**](CreateBuildInfo.md) | Build information for the sandbox | [optional] 

## Methods

### NewCreateSandbox

`func NewCreateSandbox() *CreateSandbox`

NewCreateSandbox instantiates a new CreateSandbox object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateSandboxWithDefaults

`func NewCreateSandboxWithDefaults() *CreateSandbox`

NewCreateSandboxWithDefaults instantiates a new CreateSandbox object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetImage

`func (o *CreateSandbox) GetImage() string`

GetImage returns the Image field if non-nil, zero value otherwise.

### GetImageOk

`func (o *CreateSandbox) GetImageOk() (*string, bool)`

GetImageOk returns a tuple with the Image field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImage

`func (o *CreateSandbox) SetImage(v string)`

SetImage sets Image field to given value.

### HasImage

`func (o *CreateSandbox) HasImage() bool`

HasImage returns a boolean if a field has been set.

### GetUser

`func (o *CreateSandbox) GetUser() string`

GetUser returns the User field if non-nil, zero value otherwise.

### GetUserOk

`func (o *CreateSandbox) GetUserOk() (*string, bool)`

GetUserOk returns a tuple with the User field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUser

`func (o *CreateSandbox) SetUser(v string)`

SetUser sets User field to given value.

### HasUser

`func (o *CreateSandbox) HasUser() bool`

HasUser returns a boolean if a field has been set.

### GetEnv

`func (o *CreateSandbox) GetEnv() map[string]string`

GetEnv returns the Env field if non-nil, zero value otherwise.

### GetEnvOk

`func (o *CreateSandbox) GetEnvOk() (*map[string]string, bool)`

GetEnvOk returns a tuple with the Env field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnv

`func (o *CreateSandbox) SetEnv(v map[string]string)`

SetEnv sets Env field to given value.

### HasEnv

`func (o *CreateSandbox) HasEnv() bool`

HasEnv returns a boolean if a field has been set.

### GetLabels

`func (o *CreateSandbox) GetLabels() map[string]string`

GetLabels returns the Labels field if non-nil, zero value otherwise.

### GetLabelsOk

`func (o *CreateSandbox) GetLabelsOk() (*map[string]string, bool)`

GetLabelsOk returns a tuple with the Labels field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabels

`func (o *CreateSandbox) SetLabels(v map[string]string)`

SetLabels sets Labels field to given value.

### HasLabels

`func (o *CreateSandbox) HasLabels() bool`

HasLabels returns a boolean if a field has been set.

### GetPublic

`func (o *CreateSandbox) GetPublic() bool`

GetPublic returns the Public field if non-nil, zero value otherwise.

### GetPublicOk

`func (o *CreateSandbox) GetPublicOk() (*bool, bool)`

GetPublicOk returns a tuple with the Public field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPublic

`func (o *CreateSandbox) SetPublic(v bool)`

SetPublic sets Public field to given value.

### HasPublic

`func (o *CreateSandbox) HasPublic() bool`

HasPublic returns a boolean if a field has been set.

### GetClass

`func (o *CreateSandbox) GetClass() string`

GetClass returns the Class field if non-nil, zero value otherwise.

### GetClassOk

`func (o *CreateSandbox) GetClassOk() (*string, bool)`

GetClassOk returns a tuple with the Class field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetClass

`func (o *CreateSandbox) SetClass(v string)`

SetClass sets Class field to given value.

### HasClass

`func (o *CreateSandbox) HasClass() bool`

HasClass returns a boolean if a field has been set.

### GetTarget

`func (o *CreateSandbox) GetTarget() string`

GetTarget returns the Target field if non-nil, zero value otherwise.

### GetTargetOk

`func (o *CreateSandbox) GetTargetOk() (*string, bool)`

GetTargetOk returns a tuple with the Target field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTarget

`func (o *CreateSandbox) SetTarget(v string)`

SetTarget sets Target field to given value.

### HasTarget

`func (o *CreateSandbox) HasTarget() bool`

HasTarget returns a boolean if a field has been set.

### GetCpu

`func (o *CreateSandbox) GetCpu() int32`

GetCpu returns the Cpu field if non-nil, zero value otherwise.

### GetCpuOk

`func (o *CreateSandbox) GetCpuOk() (*int32, bool)`

GetCpuOk returns a tuple with the Cpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCpu

`func (o *CreateSandbox) SetCpu(v int32)`

SetCpu sets Cpu field to given value.

### HasCpu

`func (o *CreateSandbox) HasCpu() bool`

HasCpu returns a boolean if a field has been set.

### GetGpu

`func (o *CreateSandbox) GetGpu() int32`

GetGpu returns the Gpu field if non-nil, zero value otherwise.

### GetGpuOk

`func (o *CreateSandbox) GetGpuOk() (*int32, bool)`

GetGpuOk returns a tuple with the Gpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGpu

`func (o *CreateSandbox) SetGpu(v int32)`

SetGpu sets Gpu field to given value.

### HasGpu

`func (o *CreateSandbox) HasGpu() bool`

HasGpu returns a boolean if a field has been set.

### GetMemory

`func (o *CreateSandbox) GetMemory() int32`

GetMemory returns the Memory field if non-nil, zero value otherwise.

### GetMemoryOk

`func (o *CreateSandbox) GetMemoryOk() (*int32, bool)`

GetMemoryOk returns a tuple with the Memory field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMemory

`func (o *CreateSandbox) SetMemory(v int32)`

SetMemory sets Memory field to given value.

### HasMemory

`func (o *CreateSandbox) HasMemory() bool`

HasMemory returns a boolean if a field has been set.

### GetDisk

`func (o *CreateSandbox) GetDisk() int32`

GetDisk returns the Disk field if non-nil, zero value otherwise.

### GetDiskOk

`func (o *CreateSandbox) GetDiskOk() (*int32, bool)`

GetDiskOk returns a tuple with the Disk field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDisk

`func (o *CreateSandbox) SetDisk(v int32)`

SetDisk sets Disk field to given value.

### HasDisk

`func (o *CreateSandbox) HasDisk() bool`

HasDisk returns a boolean if a field has been set.

### GetAutoStopInterval

`func (o *CreateSandbox) GetAutoStopInterval() int32`

GetAutoStopInterval returns the AutoStopInterval field if non-nil, zero value otherwise.

### GetAutoStopIntervalOk

`func (o *CreateSandbox) GetAutoStopIntervalOk() (*int32, bool)`

GetAutoStopIntervalOk returns a tuple with the AutoStopInterval field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAutoStopInterval

`func (o *CreateSandbox) SetAutoStopInterval(v int32)`

SetAutoStopInterval sets AutoStopInterval field to given value.

### HasAutoStopInterval

`func (o *CreateSandbox) HasAutoStopInterval() bool`

HasAutoStopInterval returns a boolean if a field has been set.

### GetAutoArchiveInterval

`func (o *CreateSandbox) GetAutoArchiveInterval() int32`

GetAutoArchiveInterval returns the AutoArchiveInterval field if non-nil, zero value otherwise.

### GetAutoArchiveIntervalOk

`func (o *CreateSandbox) GetAutoArchiveIntervalOk() (*int32, bool)`

GetAutoArchiveIntervalOk returns a tuple with the AutoArchiveInterval field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAutoArchiveInterval

`func (o *CreateSandbox) SetAutoArchiveInterval(v int32)`

SetAutoArchiveInterval sets AutoArchiveInterval field to given value.

### HasAutoArchiveInterval

`func (o *CreateSandbox) HasAutoArchiveInterval() bool`

HasAutoArchiveInterval returns a boolean if a field has been set.

### GetBuckets

`func (o *CreateSandbox) GetBuckets() []SandboxBucket`

GetBuckets returns the Buckets field if non-nil, zero value otherwise.

### GetBucketsOk

`func (o *CreateSandbox) GetBucketsOk() (*[]SandboxBucket, bool)`

GetBucketsOk returns a tuple with the Buckets field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBuckets

`func (o *CreateSandbox) SetBuckets(v []SandboxBucket)`

SetBuckets sets Buckets field to given value.

### HasBuckets

`func (o *CreateSandbox) HasBuckets() bool`

HasBuckets returns a boolean if a field has been set.

### GetBuildInfo

`func (o *CreateSandbox) GetBuildInfo() CreateBuildInfo`

GetBuildInfo returns the BuildInfo field if non-nil, zero value otherwise.

### GetBuildInfoOk

`func (o *CreateSandbox) GetBuildInfoOk() (*CreateBuildInfo, bool)`

GetBuildInfoOk returns a tuple with the BuildInfo field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBuildInfo

`func (o *CreateSandbox) SetBuildInfo(v CreateBuildInfo)`

SetBuildInfo sets BuildInfo field to given value.

### HasBuildInfo

`func (o *CreateSandbox) HasBuildInfo() bool`

HasBuildInfo returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


