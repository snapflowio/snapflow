# UpdateOrganizationQuota

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**TotalCpuQuota** | **NullableFloat32** |  | 
**TotalMemoryQuota** | **NullableFloat32** |  | 
**TotalDiskQuota** | **NullableFloat32** |  | 
**MaxCpuPerSandbox** | **NullableFloat32** |  | 
**MaxMemoryPerSandbox** | **NullableFloat32** |  | 
**MaxDiskPerSandbox** | **NullableFloat32** |  | 
**ImageQuota** | **NullableFloat32** |  | 
**MaxImageSize** | **NullableFloat32** |  | 
**BucketQuota** | **NullableFloat32** |  | 

## Methods

### NewUpdateOrganizationQuota

`func NewUpdateOrganizationQuota(totalCpuQuota NullableFloat32, totalMemoryQuota NullableFloat32, totalDiskQuota NullableFloat32, maxCpuPerSandbox NullableFloat32, maxMemoryPerSandbox NullableFloat32, maxDiskPerSandbox NullableFloat32, imageQuota NullableFloat32, maxImageSize NullableFloat32, bucketQuota NullableFloat32, ) *UpdateOrganizationQuota`

NewUpdateOrganizationQuota instantiates a new UpdateOrganizationQuota object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewUpdateOrganizationQuotaWithDefaults

`func NewUpdateOrganizationQuotaWithDefaults() *UpdateOrganizationQuota`

NewUpdateOrganizationQuotaWithDefaults instantiates a new UpdateOrganizationQuota object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTotalCpuQuota

`func (o *UpdateOrganizationQuota) GetTotalCpuQuota() float32`

GetTotalCpuQuota returns the TotalCpuQuota field if non-nil, zero value otherwise.

### GetTotalCpuQuotaOk

`func (o *UpdateOrganizationQuota) GetTotalCpuQuotaOk() (*float32, bool)`

GetTotalCpuQuotaOk returns a tuple with the TotalCpuQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalCpuQuota

`func (o *UpdateOrganizationQuota) SetTotalCpuQuota(v float32)`

SetTotalCpuQuota sets TotalCpuQuota field to given value.


### SetTotalCpuQuotaNil

`func (o *UpdateOrganizationQuota) SetTotalCpuQuotaNil(b bool)`

 SetTotalCpuQuotaNil sets the value for TotalCpuQuota to be an explicit nil

### UnsetTotalCpuQuota
`func (o *UpdateOrganizationQuota) UnsetTotalCpuQuota()`

UnsetTotalCpuQuota ensures that no value is present for TotalCpuQuota, not even an explicit nil
### GetTotalMemoryQuota

`func (o *UpdateOrganizationQuota) GetTotalMemoryQuota() float32`

GetTotalMemoryQuota returns the TotalMemoryQuota field if non-nil, zero value otherwise.

### GetTotalMemoryQuotaOk

`func (o *UpdateOrganizationQuota) GetTotalMemoryQuotaOk() (*float32, bool)`

GetTotalMemoryQuotaOk returns a tuple with the TotalMemoryQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalMemoryQuota

`func (o *UpdateOrganizationQuota) SetTotalMemoryQuota(v float32)`

SetTotalMemoryQuota sets TotalMemoryQuota field to given value.


### SetTotalMemoryQuotaNil

`func (o *UpdateOrganizationQuota) SetTotalMemoryQuotaNil(b bool)`

 SetTotalMemoryQuotaNil sets the value for TotalMemoryQuota to be an explicit nil

### UnsetTotalMemoryQuota
`func (o *UpdateOrganizationQuota) UnsetTotalMemoryQuota()`

UnsetTotalMemoryQuota ensures that no value is present for TotalMemoryQuota, not even an explicit nil
### GetTotalDiskQuota

`func (o *UpdateOrganizationQuota) GetTotalDiskQuota() float32`

GetTotalDiskQuota returns the TotalDiskQuota field if non-nil, zero value otherwise.

### GetTotalDiskQuotaOk

`func (o *UpdateOrganizationQuota) GetTotalDiskQuotaOk() (*float32, bool)`

GetTotalDiskQuotaOk returns a tuple with the TotalDiskQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalDiskQuota

`func (o *UpdateOrganizationQuota) SetTotalDiskQuota(v float32)`

SetTotalDiskQuota sets TotalDiskQuota field to given value.


### SetTotalDiskQuotaNil

`func (o *UpdateOrganizationQuota) SetTotalDiskQuotaNil(b bool)`

 SetTotalDiskQuotaNil sets the value for TotalDiskQuota to be an explicit nil

### UnsetTotalDiskQuota
`func (o *UpdateOrganizationQuota) UnsetTotalDiskQuota()`

UnsetTotalDiskQuota ensures that no value is present for TotalDiskQuota, not even an explicit nil
### GetMaxCpuPerSandbox

`func (o *UpdateOrganizationQuota) GetMaxCpuPerSandbox() float32`

GetMaxCpuPerSandbox returns the MaxCpuPerSandbox field if non-nil, zero value otherwise.

### GetMaxCpuPerSandboxOk

`func (o *UpdateOrganizationQuota) GetMaxCpuPerSandboxOk() (*float32, bool)`

GetMaxCpuPerSandboxOk returns a tuple with the MaxCpuPerSandbox field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxCpuPerSandbox

`func (o *UpdateOrganizationQuota) SetMaxCpuPerSandbox(v float32)`

SetMaxCpuPerSandbox sets MaxCpuPerSandbox field to given value.


### SetMaxCpuPerSandboxNil

`func (o *UpdateOrganizationQuota) SetMaxCpuPerSandboxNil(b bool)`

 SetMaxCpuPerSandboxNil sets the value for MaxCpuPerSandbox to be an explicit nil

### UnsetMaxCpuPerSandbox
`func (o *UpdateOrganizationQuota) UnsetMaxCpuPerSandbox()`

UnsetMaxCpuPerSandbox ensures that no value is present for MaxCpuPerSandbox, not even an explicit nil
### GetMaxMemoryPerSandbox

`func (o *UpdateOrganizationQuota) GetMaxMemoryPerSandbox() float32`

GetMaxMemoryPerSandbox returns the MaxMemoryPerSandbox field if non-nil, zero value otherwise.

### GetMaxMemoryPerSandboxOk

`func (o *UpdateOrganizationQuota) GetMaxMemoryPerSandboxOk() (*float32, bool)`

GetMaxMemoryPerSandboxOk returns a tuple with the MaxMemoryPerSandbox field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxMemoryPerSandbox

`func (o *UpdateOrganizationQuota) SetMaxMemoryPerSandbox(v float32)`

SetMaxMemoryPerSandbox sets MaxMemoryPerSandbox field to given value.


### SetMaxMemoryPerSandboxNil

`func (o *UpdateOrganizationQuota) SetMaxMemoryPerSandboxNil(b bool)`

 SetMaxMemoryPerSandboxNil sets the value for MaxMemoryPerSandbox to be an explicit nil

### UnsetMaxMemoryPerSandbox
`func (o *UpdateOrganizationQuota) UnsetMaxMemoryPerSandbox()`

UnsetMaxMemoryPerSandbox ensures that no value is present for MaxMemoryPerSandbox, not even an explicit nil
### GetMaxDiskPerSandbox

`func (o *UpdateOrganizationQuota) GetMaxDiskPerSandbox() float32`

GetMaxDiskPerSandbox returns the MaxDiskPerSandbox field if non-nil, zero value otherwise.

### GetMaxDiskPerSandboxOk

`func (o *UpdateOrganizationQuota) GetMaxDiskPerSandboxOk() (*float32, bool)`

GetMaxDiskPerSandboxOk returns a tuple with the MaxDiskPerSandbox field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxDiskPerSandbox

`func (o *UpdateOrganizationQuota) SetMaxDiskPerSandbox(v float32)`

SetMaxDiskPerSandbox sets MaxDiskPerSandbox field to given value.


### SetMaxDiskPerSandboxNil

`func (o *UpdateOrganizationQuota) SetMaxDiskPerSandboxNil(b bool)`

 SetMaxDiskPerSandboxNil sets the value for MaxDiskPerSandbox to be an explicit nil

### UnsetMaxDiskPerSandbox
`func (o *UpdateOrganizationQuota) UnsetMaxDiskPerSandbox()`

UnsetMaxDiskPerSandbox ensures that no value is present for MaxDiskPerSandbox, not even an explicit nil
### GetImageQuota

`func (o *UpdateOrganizationQuota) GetImageQuota() float32`

GetImageQuota returns the ImageQuota field if non-nil, zero value otherwise.

### GetImageQuotaOk

`func (o *UpdateOrganizationQuota) GetImageQuotaOk() (*float32, bool)`

GetImageQuotaOk returns a tuple with the ImageQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageQuota

`func (o *UpdateOrganizationQuota) SetImageQuota(v float32)`

SetImageQuota sets ImageQuota field to given value.


### SetImageQuotaNil

`func (o *UpdateOrganizationQuota) SetImageQuotaNil(b bool)`

 SetImageQuotaNil sets the value for ImageQuota to be an explicit nil

### UnsetImageQuota
`func (o *UpdateOrganizationQuota) UnsetImageQuota()`

UnsetImageQuota ensures that no value is present for ImageQuota, not even an explicit nil
### GetMaxImageSize

`func (o *UpdateOrganizationQuota) GetMaxImageSize() float32`

GetMaxImageSize returns the MaxImageSize field if non-nil, zero value otherwise.

### GetMaxImageSizeOk

`func (o *UpdateOrganizationQuota) GetMaxImageSizeOk() (*float32, bool)`

GetMaxImageSizeOk returns a tuple with the MaxImageSize field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxImageSize

`func (o *UpdateOrganizationQuota) SetMaxImageSize(v float32)`

SetMaxImageSize sets MaxImageSize field to given value.


### SetMaxImageSizeNil

`func (o *UpdateOrganizationQuota) SetMaxImageSizeNil(b bool)`

 SetMaxImageSizeNil sets the value for MaxImageSize to be an explicit nil

### UnsetMaxImageSize
`func (o *UpdateOrganizationQuota) UnsetMaxImageSize()`

UnsetMaxImageSize ensures that no value is present for MaxImageSize, not even an explicit nil
### GetBucketQuota

`func (o *UpdateOrganizationQuota) GetBucketQuota() float32`

GetBucketQuota returns the BucketQuota field if non-nil, zero value otherwise.

### GetBucketQuotaOk

`func (o *UpdateOrganizationQuota) GetBucketQuotaOk() (*float32, bool)`

GetBucketQuotaOk returns a tuple with the BucketQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBucketQuota

`func (o *UpdateOrganizationQuota) SetBucketQuota(v float32)`

SetBucketQuota sets BucketQuota field to given value.


### SetBucketQuotaNil

`func (o *UpdateOrganizationQuota) SetBucketQuotaNil(b bool)`

 SetBucketQuotaNil sets the value for BucketQuota to be an explicit nil

### UnsetBucketQuota
`func (o *UpdateOrganizationQuota) UnsetBucketQuota()`

UnsetBucketQuota ensures that no value is present for BucketQuota, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


