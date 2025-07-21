# UpdateDockerRegistry

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | **string** | Registry name | 
**Username** | **string** | Registry username | 
**Password** | Pointer to **string** | Registry password | [optional] 

## Methods

### NewUpdateDockerRegistry

`func NewUpdateDockerRegistry(name string, username string, ) *UpdateDockerRegistry`

NewUpdateDockerRegistry instantiates a new UpdateDockerRegistry object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewUpdateDockerRegistryWithDefaults

`func NewUpdateDockerRegistryWithDefaults() *UpdateDockerRegistry`

NewUpdateDockerRegistryWithDefaults instantiates a new UpdateDockerRegistry object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *UpdateDockerRegistry) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *UpdateDockerRegistry) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *UpdateDockerRegistry) SetName(v string)`

SetName sets Name field to given value.


### GetUsername

`func (o *UpdateDockerRegistry) GetUsername() string`

GetUsername returns the Username field if non-nil, zero value otherwise.

### GetUsernameOk

`func (o *UpdateDockerRegistry) GetUsernameOk() (*string, bool)`

GetUsernameOk returns a tuple with the Username field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUsername

`func (o *UpdateDockerRegistry) SetUsername(v string)`

SetUsername sets Username field to given value.


### GetPassword

`func (o *UpdateDockerRegistry) GetPassword() string`

GetPassword returns the Password field if non-nil, zero value otherwise.

### GetPasswordOk

`func (o *UpdateDockerRegistry) GetPasswordOk() (*string, bool)`

GetPasswordOk returns a tuple with the Password field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPassword

`func (o *UpdateDockerRegistry) SetPassword(v string)`

SetPassword sets Password field to given value.

### HasPassword

`func (o *UpdateDockerRegistry) HasPassword() bool`

HasPassword returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


