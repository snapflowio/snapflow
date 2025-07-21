# CreateOrganizationQuota

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**TotalCpuQuota** | Pointer to **float32** |  | [optional] 
**TotalMemoryQuota** | Pointer to **float32** |  | [optional] 
**TotalDiskQuota** | Pointer to **float32** |  | [optional] 
**MaxCpuPerSandbox** | Pointer to **float32** |  | [optional] 
**MaxMemoryPerSandbox** | Pointer to **float32** |  | [optional] 
**MaxDiskPerSandbox** | Pointer to **float32** |  | [optional] 
**ImageQuota** | Pointer to **float32** |  | [optional] 
**MaxImageSize** | Pointer to **float32** |  | [optional] 
**BucketQuota** | Pointer to **float32** |  | [optional] 

## Methods

### NewCreateOrganizationQuota

`func NewCreateOrganizationQuota() *CreateOrganizationQuota`

NewCreateOrganizationQuota instantiates a new CreateOrganizationQuota object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateOrganizationQuotaWithDefaults

`func NewCreateOrganizationQuotaWithDefaults() *CreateOrganizationQuota`

NewCreateOrganizationQuotaWithDefaults instantiates a new CreateOrganizationQuota object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTotalCpuQuota

`func (o *CreateOrganizationQuota) GetTotalCpuQuota() float32`

GetTotalCpuQuota returns the TotalCpuQuota field if non-nil, zero value otherwise.

### GetTotalCpuQuotaOk

`func (o *CreateOrganizationQuota) GetTotalCpuQuotaOk() (*float32, bool)`

GetTotalCpuQuotaOk returns a tuple with the TotalCpuQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalCpuQuota

`func (o *CreateOrganizationQuota) SetTotalCpuQuota(v float32)`

SetTotalCpuQuota sets TotalCpuQuota field to given value.

### HasTotalCpuQuota

`func (o *CreateOrganizationQuota) HasTotalCpuQuota() bool`

HasTotalCpuQuota returns a boolean if a field has been set.

### GetTotalMemoryQuota

`func (o *CreateOrganizationQuota) GetTotalMemoryQuota() float32`

GetTotalMemoryQuota returns the TotalMemoryQuota field if non-nil, zero value otherwise.

### GetTotalMemoryQuotaOk

`func (o *CreateOrganizationQuota) GetTotalMemoryQuotaOk() (*float32, bool)`

GetTotalMemoryQuotaOk returns a tuple with the TotalMemoryQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalMemoryQuota

`func (o *CreateOrganizationQuota) SetTotalMemoryQuota(v float32)`

SetTotalMemoryQuota sets TotalMemoryQuota field to given value.

### HasTotalMemoryQuota

`func (o *CreateOrganizationQuota) HasTotalMemoryQuota() bool`

HasTotalMemoryQuota returns a boolean if a field has been set.

### GetTotalDiskQuota

`func (o *CreateOrganizationQuota) GetTotalDiskQuota() float32`

GetTotalDiskQuota returns the TotalDiskQuota field if non-nil, zero value otherwise.

### GetTotalDiskQuotaOk

`func (o *CreateOrganizationQuota) GetTotalDiskQuotaOk() (*float32, bool)`

GetTotalDiskQuotaOk returns a tuple with the TotalDiskQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalDiskQuota

`func (o *CreateOrganizationQuota) SetTotalDiskQuota(v float32)`

SetTotalDiskQuota sets TotalDiskQuota field to given value.

### HasTotalDiskQuota

`func (o *CreateOrganizationQuota) HasTotalDiskQuota() bool`

HasTotalDiskQuota returns a boolean if a field has been set.

### GetMaxCpuPerSandbox

`func (o *CreateOrganizationQuota) GetMaxCpuPerSandbox() float32`

GetMaxCpuPerSandbox returns the MaxCpuPerSandbox field if non-nil, zero value otherwise.

### GetMaxCpuPerSandboxOk

`func (o *CreateOrganizationQuota) GetMaxCpuPerSandboxOk() (*float32, bool)`

GetMaxCpuPerSandboxOk returns a tuple with the MaxCpuPerSandbox field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxCpuPerSandbox

`func (o *CreateOrganizationQuota) SetMaxCpuPerSandbox(v float32)`

SetMaxCpuPerSandbox sets MaxCpuPerSandbox field to given value.

### HasMaxCpuPerSandbox

`func (o *CreateOrganizationQuota) HasMaxCpuPerSandbox() bool`

HasMaxCpuPerSandbox returns a boolean if a field has been set.

### GetMaxMemoryPerSandbox

`func (o *CreateOrganizationQuota) GetMaxMemoryPerSandbox() float32`

GetMaxMemoryPerSandbox returns the MaxMemoryPerSandbox field if non-nil, zero value otherwise.

### GetMaxMemoryPerSandboxOk

`func (o *CreateOrganizationQuota) GetMaxMemoryPerSandboxOk() (*float32, bool)`

GetMaxMemoryPerSandboxOk returns a tuple with the MaxMemoryPerSandbox field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxMemoryPerSandbox

`func (o *CreateOrganizationQuota) SetMaxMemoryPerSandbox(v float32)`

SetMaxMemoryPerSandbox sets MaxMemoryPerSandbox field to given value.

### HasMaxMemoryPerSandbox

`func (o *CreateOrganizationQuota) HasMaxMemoryPerSandbox() bool`

HasMaxMemoryPerSandbox returns a boolean if a field has been set.

### GetMaxDiskPerSandbox

`func (o *CreateOrganizationQuota) GetMaxDiskPerSandbox() float32`

GetMaxDiskPerSandbox returns the MaxDiskPerSandbox field if non-nil, zero value otherwise.

### GetMaxDiskPerSandboxOk

`func (o *CreateOrganizationQuota) GetMaxDiskPerSandboxOk() (*float32, bool)`

GetMaxDiskPerSandboxOk returns a tuple with the MaxDiskPerSandbox field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxDiskPerSandbox

`func (o *CreateOrganizationQuota) SetMaxDiskPerSandbox(v float32)`

SetMaxDiskPerSandbox sets MaxDiskPerSandbox field to given value.

### HasMaxDiskPerSandbox

`func (o *CreateOrganizationQuota) HasMaxDiskPerSandbox() bool`

HasMaxDiskPerSandbox returns a boolean if a field has been set.

### GetImageQuota

`func (o *CreateOrganizationQuota) GetImageQuota() float32`

GetImageQuota returns the ImageQuota field if non-nil, zero value otherwise.

### GetImageQuotaOk

`func (o *CreateOrganizationQuota) GetImageQuotaOk() (*float32, bool)`

GetImageQuotaOk returns a tuple with the ImageQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageQuota

`func (o *CreateOrganizationQuota) SetImageQuota(v float32)`

SetImageQuota sets ImageQuota field to given value.

### HasImageQuota

`func (o *CreateOrganizationQuota) HasImageQuota() bool`

HasImageQuota returns a boolean if a field has been set.

### GetMaxImageSize

`func (o *CreateOrganizationQuota) GetMaxImageSize() float32`

GetMaxImageSize returns the MaxImageSize field if non-nil, zero value otherwise.

### GetMaxImageSizeOk

`func (o *CreateOrganizationQuota) GetMaxImageSizeOk() (*float32, bool)`

GetMaxImageSizeOk returns a tuple with the MaxImageSize field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxImageSize

`func (o *CreateOrganizationQuota) SetMaxImageSize(v float32)`

SetMaxImageSize sets MaxImageSize field to given value.

### HasMaxImageSize

`func (o *CreateOrganizationQuota) HasMaxImageSize() bool`

HasMaxImageSize returns a boolean if a field has been set.

### GetBucketQuota

`func (o *CreateOrganizationQuota) GetBucketQuota() float32`

GetBucketQuota returns the BucketQuota field if non-nil, zero value otherwise.

### GetBucketQuotaOk

`func (o *CreateOrganizationQuota) GetBucketQuotaOk() (*float32, bool)`

GetBucketQuotaOk returns a tuple with the BucketQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBucketQuota

`func (o *CreateOrganizationQuota) SetBucketQuota(v float32)`

SetBucketQuota sets BucketQuota field to given value.

### HasBucketQuota

`func (o *CreateOrganizationQuota) HasBucketQuota() bool`

HasBucketQuota returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


