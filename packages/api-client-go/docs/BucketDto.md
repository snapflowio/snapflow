# BucketDto

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** | Bucket ID | 
**Name** | **string** | Bucket name | 
**OrganizationId** | **string** | Organization ID | 
**State** | [**BucketState**](BucketState.md) | Bucket state | 
**CreatedAt** | **string** | Creation timestamp | 
**UpdatedAt** | **string** | Last update timestamp | 
**LastUsedAt** | Pointer to **NullableString** | Last used timestamp | [optional] 
**ErrorReason** | **NullableString** | The error reason of the bucket | 

## Methods

### NewBucketDto

`func NewBucketDto(id string, name string, organizationId string, state BucketState, createdAt string, updatedAt string, errorReason NullableString, ) *BucketDto`

NewBucketDto instantiates a new BucketDto object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBucketDtoWithDefaults

`func NewBucketDtoWithDefaults() *BucketDto`

NewBucketDtoWithDefaults instantiates a new BucketDto object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *BucketDto) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *BucketDto) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *BucketDto) SetId(v string)`

SetId sets Id field to given value.


### GetName

`func (o *BucketDto) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *BucketDto) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *BucketDto) SetName(v string)`

SetName sets Name field to given value.


### GetOrganizationId

`func (o *BucketDto) GetOrganizationId() string`

GetOrganizationId returns the OrganizationId field if non-nil, zero value otherwise.

### GetOrganizationIdOk

`func (o *BucketDto) GetOrganizationIdOk() (*string, bool)`

GetOrganizationIdOk returns a tuple with the OrganizationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOrganizationId

`func (o *BucketDto) SetOrganizationId(v string)`

SetOrganizationId sets OrganizationId field to given value.


### GetState

`func (o *BucketDto) GetState() BucketState`

GetState returns the State field if non-nil, zero value otherwise.

### GetStateOk

`func (o *BucketDto) GetStateOk() (*BucketState, bool)`

GetStateOk returns a tuple with the State field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetState

`func (o *BucketDto) SetState(v BucketState)`

SetState sets State field to given value.


### GetCreatedAt

`func (o *BucketDto) GetCreatedAt() string`

GetCreatedAt returns the CreatedAt field if non-nil, zero value otherwise.

### GetCreatedAtOk

`func (o *BucketDto) GetCreatedAtOk() (*string, bool)`

GetCreatedAtOk returns a tuple with the CreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedAt

`func (o *BucketDto) SetCreatedAt(v string)`

SetCreatedAt sets CreatedAt field to given value.


### GetUpdatedAt

`func (o *BucketDto) GetUpdatedAt() string`

GetUpdatedAt returns the UpdatedAt field if non-nil, zero value otherwise.

### GetUpdatedAtOk

`func (o *BucketDto) GetUpdatedAtOk() (*string, bool)`

GetUpdatedAtOk returns a tuple with the UpdatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUpdatedAt

`func (o *BucketDto) SetUpdatedAt(v string)`

SetUpdatedAt sets UpdatedAt field to given value.


### GetLastUsedAt

`func (o *BucketDto) GetLastUsedAt() string`

GetLastUsedAt returns the LastUsedAt field if non-nil, zero value otherwise.

### GetLastUsedAtOk

`func (o *BucketDto) GetLastUsedAtOk() (*string, bool)`

GetLastUsedAtOk returns a tuple with the LastUsedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLastUsedAt

`func (o *BucketDto) SetLastUsedAt(v string)`

SetLastUsedAt sets LastUsedAt field to given value.

### HasLastUsedAt

`func (o *BucketDto) HasLastUsedAt() bool`

HasLastUsedAt returns a boolean if a field has been set.

### SetLastUsedAtNil

`func (o *BucketDto) SetLastUsedAtNil(b bool)`

 SetLastUsedAtNil sets the value for LastUsedAt to be an explicit nil

### UnsetLastUsedAt
`func (o *BucketDto) UnsetLastUsedAt()`

UnsetLastUsedAt ensures that no value is present for LastUsedAt, not even an explicit nil
### GetErrorReason

`func (o *BucketDto) GetErrorReason() string`

GetErrorReason returns the ErrorReason field if non-nil, zero value otherwise.

### GetErrorReasonOk

`func (o *BucketDto) GetErrorReasonOk() (*string, bool)`

GetErrorReasonOk returns a tuple with the ErrorReason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetErrorReason

`func (o *BucketDto) SetErrorReason(v string)`

SetErrorReason sets ErrorReason field to given value.


### SetErrorReasonNil

`func (o *BucketDto) SetErrorReasonNil(b bool)`

 SetErrorReasonNil sets the value for ErrorReason to be an explicit nil

### UnsetErrorReason
`func (o *BucketDto) UnsetErrorReason()`

UnsetErrorReason ensures that no value is present for ErrorReason, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


