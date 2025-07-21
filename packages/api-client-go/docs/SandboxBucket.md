# SandboxBucket

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**BucketId** | **string** | The ID of the bucket | 
**MountPath** | **string** | The mount path for the bucket | 

## Methods

### NewSandboxBucket

`func NewSandboxBucket(bucketId string, mountPath string, ) *SandboxBucket`

NewSandboxBucket instantiates a new SandboxBucket object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSandboxBucketWithDefaults

`func NewSandboxBucketWithDefaults() *SandboxBucket`

NewSandboxBucketWithDefaults instantiates a new SandboxBucket object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBucketId

`func (o *SandboxBucket) GetBucketId() string`

GetBucketId returns the BucketId field if non-nil, zero value otherwise.

### GetBucketIdOk

`func (o *SandboxBucket) GetBucketIdOk() (*string, bool)`

GetBucketIdOk returns a tuple with the BucketId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBucketId

`func (o *SandboxBucket) SetBucketId(v string)`

SetBucketId sets BucketId field to given value.


### GetMountPath

`func (o *SandboxBucket) GetMountPath() string`

GetMountPath returns the MountPath field if non-nil, zero value otherwise.

### GetMountPathOk

`func (o *SandboxBucket) GetMountPathOk() (*string, bool)`

GetMountPathOk returns a tuple with the MountPath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMountPath

`func (o *SandboxBucket) SetMountPath(v string)`

SetMountPath sets MountPath field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


