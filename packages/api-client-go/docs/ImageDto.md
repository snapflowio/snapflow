# ImageDto

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** |  | 
**OrganizationId** | Pointer to **string** |  | [optional] 
**General** | **bool** |  | 
**Name** | **string** |  | 
**ImageName** | Pointer to **string** |  | [optional] 
**Enabled** | **bool** |  | 
**State** | [**ImageState**](ImageState.md) |  | 
**Size** | **NullableFloat32** |  | 
**Entrypoint** | **[]string** |  | 
**Cpu** | **float32** |  | 
**Gpu** | **float32** |  | 
**Mem** | **float32** |  | 
**Disk** | **float32** |  | 
**ErrorReason** | **NullableString** |  | 
**CreatedAt** | **time.Time** |  | 
**UpdatedAt** | **time.Time** |  | 
**LastUsedAt** | **NullableTime** |  | 
**BuildInfo** | Pointer to [**BuildInfo**](BuildInfo.md) | Build information for the image | [optional] 

## Methods

### NewImageDto

`func NewImageDto(id string, general bool, name string, enabled bool, state ImageState, size NullableFloat32, entrypoint []string, cpu float32, gpu float32, mem float32, disk float32, errorReason NullableString, createdAt time.Time, updatedAt time.Time, lastUsedAt NullableTime, ) *ImageDto`

NewImageDto instantiates a new ImageDto object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewImageDtoWithDefaults

`func NewImageDtoWithDefaults() *ImageDto`

NewImageDtoWithDefaults instantiates a new ImageDto object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *ImageDto) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *ImageDto) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *ImageDto) SetId(v string)`

SetId sets Id field to given value.


### GetOrganizationId

`func (o *ImageDto) GetOrganizationId() string`

GetOrganizationId returns the OrganizationId field if non-nil, zero value otherwise.

### GetOrganizationIdOk

`func (o *ImageDto) GetOrganizationIdOk() (*string, bool)`

GetOrganizationIdOk returns a tuple with the OrganizationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOrganizationId

`func (o *ImageDto) SetOrganizationId(v string)`

SetOrganizationId sets OrganizationId field to given value.

### HasOrganizationId

`func (o *ImageDto) HasOrganizationId() bool`

HasOrganizationId returns a boolean if a field has been set.

### GetGeneral

`func (o *ImageDto) GetGeneral() bool`

GetGeneral returns the General field if non-nil, zero value otherwise.

### GetGeneralOk

`func (o *ImageDto) GetGeneralOk() (*bool, bool)`

GetGeneralOk returns a tuple with the General field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGeneral

`func (o *ImageDto) SetGeneral(v bool)`

SetGeneral sets General field to given value.


### GetName

`func (o *ImageDto) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *ImageDto) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *ImageDto) SetName(v string)`

SetName sets Name field to given value.


### GetImageName

`func (o *ImageDto) GetImageName() string`

GetImageName returns the ImageName field if non-nil, zero value otherwise.

### GetImageNameOk

`func (o *ImageDto) GetImageNameOk() (*string, bool)`

GetImageNameOk returns a tuple with the ImageName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageName

`func (o *ImageDto) SetImageName(v string)`

SetImageName sets ImageName field to given value.

### HasImageName

`func (o *ImageDto) HasImageName() bool`

HasImageName returns a boolean if a field has been set.

### GetEnabled

`func (o *ImageDto) GetEnabled() bool`

GetEnabled returns the Enabled field if non-nil, zero value otherwise.

### GetEnabledOk

`func (o *ImageDto) GetEnabledOk() (*bool, bool)`

GetEnabledOk returns a tuple with the Enabled field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnabled

`func (o *ImageDto) SetEnabled(v bool)`

SetEnabled sets Enabled field to given value.


### GetState

`func (o *ImageDto) GetState() ImageState`

GetState returns the State field if non-nil, zero value otherwise.

### GetStateOk

`func (o *ImageDto) GetStateOk() (*ImageState, bool)`

GetStateOk returns a tuple with the State field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetState

`func (o *ImageDto) SetState(v ImageState)`

SetState sets State field to given value.


### GetSize

`func (o *ImageDto) GetSize() float32`

GetSize returns the Size field if non-nil, zero value otherwise.

### GetSizeOk

`func (o *ImageDto) GetSizeOk() (*float32, bool)`

GetSizeOk returns a tuple with the Size field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSize

`func (o *ImageDto) SetSize(v float32)`

SetSize sets Size field to given value.


### SetSizeNil

`func (o *ImageDto) SetSizeNil(b bool)`

 SetSizeNil sets the value for Size to be an explicit nil

### UnsetSize
`func (o *ImageDto) UnsetSize()`

UnsetSize ensures that no value is present for Size, not even an explicit nil
### GetEntrypoint

`func (o *ImageDto) GetEntrypoint() []string`

GetEntrypoint returns the Entrypoint field if non-nil, zero value otherwise.

### GetEntrypointOk

`func (o *ImageDto) GetEntrypointOk() (*[]string, bool)`

GetEntrypointOk returns a tuple with the Entrypoint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEntrypoint

`func (o *ImageDto) SetEntrypoint(v []string)`

SetEntrypoint sets Entrypoint field to given value.


### SetEntrypointNil

`func (o *ImageDto) SetEntrypointNil(b bool)`

 SetEntrypointNil sets the value for Entrypoint to be an explicit nil

### UnsetEntrypoint
`func (o *ImageDto) UnsetEntrypoint()`

UnsetEntrypoint ensures that no value is present for Entrypoint, not even an explicit nil
### GetCpu

`func (o *ImageDto) GetCpu() float32`

GetCpu returns the Cpu field if non-nil, zero value otherwise.

### GetCpuOk

`func (o *ImageDto) GetCpuOk() (*float32, bool)`

GetCpuOk returns a tuple with the Cpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCpu

`func (o *ImageDto) SetCpu(v float32)`

SetCpu sets Cpu field to given value.


### GetGpu

`func (o *ImageDto) GetGpu() float32`

GetGpu returns the Gpu field if non-nil, zero value otherwise.

### GetGpuOk

`func (o *ImageDto) GetGpuOk() (*float32, bool)`

GetGpuOk returns a tuple with the Gpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGpu

`func (o *ImageDto) SetGpu(v float32)`

SetGpu sets Gpu field to given value.


### GetMem

`func (o *ImageDto) GetMem() float32`

GetMem returns the Mem field if non-nil, zero value otherwise.

### GetMemOk

`func (o *ImageDto) GetMemOk() (*float32, bool)`

GetMemOk returns a tuple with the Mem field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMem

`func (o *ImageDto) SetMem(v float32)`

SetMem sets Mem field to given value.


### GetDisk

`func (o *ImageDto) GetDisk() float32`

GetDisk returns the Disk field if non-nil, zero value otherwise.

### GetDiskOk

`func (o *ImageDto) GetDiskOk() (*float32, bool)`

GetDiskOk returns a tuple with the Disk field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDisk

`func (o *ImageDto) SetDisk(v float32)`

SetDisk sets Disk field to given value.


### GetErrorReason

`func (o *ImageDto) GetErrorReason() string`

GetErrorReason returns the ErrorReason field if non-nil, zero value otherwise.

### GetErrorReasonOk

`func (o *ImageDto) GetErrorReasonOk() (*string, bool)`

GetErrorReasonOk returns a tuple with the ErrorReason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetErrorReason

`func (o *ImageDto) SetErrorReason(v string)`

SetErrorReason sets ErrorReason field to given value.


### SetErrorReasonNil

`func (o *ImageDto) SetErrorReasonNil(b bool)`

 SetErrorReasonNil sets the value for ErrorReason to be an explicit nil

### UnsetErrorReason
`func (o *ImageDto) UnsetErrorReason()`

UnsetErrorReason ensures that no value is present for ErrorReason, not even an explicit nil
### GetCreatedAt

`func (o *ImageDto) GetCreatedAt() time.Time`

GetCreatedAt returns the CreatedAt field if non-nil, zero value otherwise.

### GetCreatedAtOk

`func (o *ImageDto) GetCreatedAtOk() (*time.Time, bool)`

GetCreatedAtOk returns a tuple with the CreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedAt

`func (o *ImageDto) SetCreatedAt(v time.Time)`

SetCreatedAt sets CreatedAt field to given value.


### GetUpdatedAt

`func (o *ImageDto) GetUpdatedAt() time.Time`

GetUpdatedAt returns the UpdatedAt field if non-nil, zero value otherwise.

### GetUpdatedAtOk

`func (o *ImageDto) GetUpdatedAtOk() (*time.Time, bool)`

GetUpdatedAtOk returns a tuple with the UpdatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUpdatedAt

`func (o *ImageDto) SetUpdatedAt(v time.Time)`

SetUpdatedAt sets UpdatedAt field to given value.


### GetLastUsedAt

`func (o *ImageDto) GetLastUsedAt() time.Time`

GetLastUsedAt returns the LastUsedAt field if non-nil, zero value otherwise.

### GetLastUsedAtOk

`func (o *ImageDto) GetLastUsedAtOk() (*time.Time, bool)`

GetLastUsedAtOk returns a tuple with the LastUsedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLastUsedAt

`func (o *ImageDto) SetLastUsedAt(v time.Time)`

SetLastUsedAt sets LastUsedAt field to given value.


### SetLastUsedAtNil

`func (o *ImageDto) SetLastUsedAtNil(b bool)`

 SetLastUsedAtNil sets the value for LastUsedAt to be an explicit nil

### UnsetLastUsedAt
`func (o *ImageDto) UnsetLastUsedAt()`

UnsetLastUsedAt ensures that no value is present for LastUsedAt, not even an explicit nil
### GetBuildInfo

`func (o *ImageDto) GetBuildInfo() BuildInfo`

GetBuildInfo returns the BuildInfo field if non-nil, zero value otherwise.

### GetBuildInfoOk

`func (o *ImageDto) GetBuildInfoOk() (*BuildInfo, bool)`

GetBuildInfoOk returns a tuple with the BuildInfo field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBuildInfo

`func (o *ImageDto) SetBuildInfo(v BuildInfo)`

SetBuildInfo sets BuildInfo field to given value.

### HasBuildInfo

`func (o *ImageDto) HasBuildInfo() bool`

HasBuildInfo returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


