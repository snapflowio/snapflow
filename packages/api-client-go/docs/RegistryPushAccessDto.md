# RegistryPushAccessDto

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Username** | **string** | Temporary username for registry authentication | 
**Secret** | **string** | Temporary secret for registry authentication | 
**RegistryUrl** | **string** | Registry URL | 
**RegistryId** | **string** | Registry ID | 
**Project** | **string** | Registry project ID | 
**ExpiresAt** | **string** | Token expiration time in ISO format | 

## Methods

### NewRegistryPushAccessDto

`func NewRegistryPushAccessDto(username string, secret string, registryUrl string, registryId string, project string, expiresAt string, ) *RegistryPushAccessDto`

NewRegistryPushAccessDto instantiates a new RegistryPushAccessDto object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewRegistryPushAccessDtoWithDefaults

`func NewRegistryPushAccessDtoWithDefaults() *RegistryPushAccessDto`

NewRegistryPushAccessDtoWithDefaults instantiates a new RegistryPushAccessDto object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetUsername

`func (o *RegistryPushAccessDto) GetUsername() string`

GetUsername returns the Username field if non-nil, zero value otherwise.

### GetUsernameOk

`func (o *RegistryPushAccessDto) GetUsernameOk() (*string, bool)`

GetUsernameOk returns a tuple with the Username field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUsername

`func (o *RegistryPushAccessDto) SetUsername(v string)`

SetUsername sets Username field to given value.


### GetSecret

`func (o *RegistryPushAccessDto) GetSecret() string`

GetSecret returns the Secret field if non-nil, zero value otherwise.

### GetSecretOk

`func (o *RegistryPushAccessDto) GetSecretOk() (*string, bool)`

GetSecretOk returns a tuple with the Secret field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSecret

`func (o *RegistryPushAccessDto) SetSecret(v string)`

SetSecret sets Secret field to given value.


### GetRegistryUrl

`func (o *RegistryPushAccessDto) GetRegistryUrl() string`

GetRegistryUrl returns the RegistryUrl field if non-nil, zero value otherwise.

### GetRegistryUrlOk

`func (o *RegistryPushAccessDto) GetRegistryUrlOk() (*string, bool)`

GetRegistryUrlOk returns a tuple with the RegistryUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRegistryUrl

`func (o *RegistryPushAccessDto) SetRegistryUrl(v string)`

SetRegistryUrl sets RegistryUrl field to given value.


### GetRegistryId

`func (o *RegistryPushAccessDto) GetRegistryId() string`

GetRegistryId returns the RegistryId field if non-nil, zero value otherwise.

### GetRegistryIdOk

`func (o *RegistryPushAccessDto) GetRegistryIdOk() (*string, bool)`

GetRegistryIdOk returns a tuple with the RegistryId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRegistryId

`func (o *RegistryPushAccessDto) SetRegistryId(v string)`

SetRegistryId sets RegistryId field to given value.


### GetProject

`func (o *RegistryPushAccessDto) GetProject() string`

GetProject returns the Project field if non-nil, zero value otherwise.

### GetProjectOk

`func (o *RegistryPushAccessDto) GetProjectOk() (*string, bool)`

GetProjectOk returns a tuple with the Project field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetProject

`func (o *RegistryPushAccessDto) SetProject(v string)`

SetProject sets Project field to given value.


### GetExpiresAt

`func (o *RegistryPushAccessDto) GetExpiresAt() string`

GetExpiresAt returns the ExpiresAt field if non-nil, zero value otherwise.

### GetExpiresAtOk

`func (o *RegistryPushAccessDto) GetExpiresAtOk() (*string, bool)`

GetExpiresAtOk returns a tuple with the ExpiresAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExpiresAt

`func (o *RegistryPushAccessDto) SetExpiresAt(v string)`

SetExpiresAt sets ExpiresAt field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


