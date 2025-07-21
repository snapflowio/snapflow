# CreateImage

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | **string** | The name of the image | 
**ImageName** | Pointer to **string** | The image name of the image | [optional] 
**Entrypoint** | Pointer to **[]string** | The entrypoint command for the image | [optional] 
**General** | Pointer to **bool** | Whether the image is general | [optional] 
**Cpu** | Pointer to **int32** | CPU cores allocated to the resulting sandbox | [optional] 
**Gpu** | Pointer to **int32** | GPU units allocated to the resulting sandbox | [optional] 
**Memory** | Pointer to **int32** | Memory allocated to the resulting sandbox in GB | [optional] 
**Disk** | Pointer to **int32** | Disk space allocated to the sandbox in GB | [optional] 
**BuildInfo** | Pointer to [**CreateBuildInfo**](CreateBuildInfo.md) | Build information for the image | [optional] 

## Methods

### NewCreateImage

`func NewCreateImage(name string, ) *CreateImage`

NewCreateImage instantiates a new CreateImage object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateImageWithDefaults

`func NewCreateImageWithDefaults() *CreateImage`

NewCreateImageWithDefaults instantiates a new CreateImage object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *CreateImage) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *CreateImage) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *CreateImage) SetName(v string)`

SetName sets Name field to given value.


### GetImageName

`func (o *CreateImage) GetImageName() string`

GetImageName returns the ImageName field if non-nil, zero value otherwise.

### GetImageNameOk

`func (o *CreateImage) GetImageNameOk() (*string, bool)`

GetImageNameOk returns a tuple with the ImageName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageName

`func (o *CreateImage) SetImageName(v string)`

SetImageName sets ImageName field to given value.

### HasImageName

`func (o *CreateImage) HasImageName() bool`

HasImageName returns a boolean if a field has been set.

### GetEntrypoint

`func (o *CreateImage) GetEntrypoint() []string`

GetEntrypoint returns the Entrypoint field if non-nil, zero value otherwise.

### GetEntrypointOk

`func (o *CreateImage) GetEntrypointOk() (*[]string, bool)`

GetEntrypointOk returns a tuple with the Entrypoint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEntrypoint

`func (o *CreateImage) SetEntrypoint(v []string)`

SetEntrypoint sets Entrypoint field to given value.

### HasEntrypoint

`func (o *CreateImage) HasEntrypoint() bool`

HasEntrypoint returns a boolean if a field has been set.

### GetGeneral

`func (o *CreateImage) GetGeneral() bool`

GetGeneral returns the General field if non-nil, zero value otherwise.

### GetGeneralOk

`func (o *CreateImage) GetGeneralOk() (*bool, bool)`

GetGeneralOk returns a tuple with the General field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGeneral

`func (o *CreateImage) SetGeneral(v bool)`

SetGeneral sets General field to given value.

### HasGeneral

`func (o *CreateImage) HasGeneral() bool`

HasGeneral returns a boolean if a field has been set.

### GetCpu

`func (o *CreateImage) GetCpu() int32`

GetCpu returns the Cpu field if non-nil, zero value otherwise.

### GetCpuOk

`func (o *CreateImage) GetCpuOk() (*int32, bool)`

GetCpuOk returns a tuple with the Cpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCpu

`func (o *CreateImage) SetCpu(v int32)`

SetCpu sets Cpu field to given value.

### HasCpu

`func (o *CreateImage) HasCpu() bool`

HasCpu returns a boolean if a field has been set.

### GetGpu

`func (o *CreateImage) GetGpu() int32`

GetGpu returns the Gpu field if non-nil, zero value otherwise.

### GetGpuOk

`func (o *CreateImage) GetGpuOk() (*int32, bool)`

GetGpuOk returns a tuple with the Gpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGpu

`func (o *CreateImage) SetGpu(v int32)`

SetGpu sets Gpu field to given value.

### HasGpu

`func (o *CreateImage) HasGpu() bool`

HasGpu returns a boolean if a field has been set.

### GetMemory

`func (o *CreateImage) GetMemory() int32`

GetMemory returns the Memory field if non-nil, zero value otherwise.

### GetMemoryOk

`func (o *CreateImage) GetMemoryOk() (*int32, bool)`

GetMemoryOk returns a tuple with the Memory field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMemory

`func (o *CreateImage) SetMemory(v int32)`

SetMemory sets Memory field to given value.

### HasMemory

`func (o *CreateImage) HasMemory() bool`

HasMemory returns a boolean if a field has been set.

### GetDisk

`func (o *CreateImage) GetDisk() int32`

GetDisk returns the Disk field if non-nil, zero value otherwise.

### GetDiskOk

`func (o *CreateImage) GetDiskOk() (*int32, bool)`

GetDiskOk returns a tuple with the Disk field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDisk

`func (o *CreateImage) SetDisk(v int32)`

SetDisk sets Disk field to given value.

### HasDisk

`func (o *CreateImage) HasDisk() bool`

HasDisk returns a boolean if a field has been set.

### GetBuildInfo

`func (o *CreateImage) GetBuildInfo() CreateBuildInfo`

GetBuildInfo returns the BuildInfo field if non-nil, zero value otherwise.

### GetBuildInfoOk

`func (o *CreateImage) GetBuildInfoOk() (*CreateBuildInfo, bool)`

GetBuildInfoOk returns a tuple with the BuildInfo field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBuildInfo

`func (o *CreateImage) SetBuildInfo(v CreateBuildInfo)`

SetBuildInfo sets BuildInfo field to given value.

### HasBuildInfo

`func (o *CreateImage) HasBuildInfo() bool`

HasBuildInfo returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


