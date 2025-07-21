# CreateDockerRegistry

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | **string** | Registry name | 
**Url** | **string** | Registry URL | 
**Username** | **string** | Registry username | 
**Password** | **string** | Registry password | 
**Project** | **string** | Registry project | 
**RegistryType** | **string** | Registry type | [default to "internal"]
**IsDefault** | **bool** | Set as default registry | [default to false]

## Methods

### NewCreateDockerRegistry

`func NewCreateDockerRegistry(name string, url string, username string, password string, project string, registryType string, isDefault bool, ) *CreateDockerRegistry`

NewCreateDockerRegistry instantiates a new CreateDockerRegistry object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateDockerRegistryWithDefaults

`func NewCreateDockerRegistryWithDefaults() *CreateDockerRegistry`

NewCreateDockerRegistryWithDefaults instantiates a new CreateDockerRegistry object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *CreateDockerRegistry) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *CreateDockerRegistry) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *CreateDockerRegistry) SetName(v string)`

SetName sets Name field to given value.


### GetUrl

`func (o *CreateDockerRegistry) GetUrl() string`

GetUrl returns the Url field if non-nil, zero value otherwise.

### GetUrlOk

`func (o *CreateDockerRegistry) GetUrlOk() (*string, bool)`

GetUrlOk returns a tuple with the Url field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUrl

`func (o *CreateDockerRegistry) SetUrl(v string)`

SetUrl sets Url field to given value.


### GetUsername

`func (o *CreateDockerRegistry) GetUsername() string`

GetUsername returns the Username field if non-nil, zero value otherwise.

### GetUsernameOk

`func (o *CreateDockerRegistry) GetUsernameOk() (*string, bool)`

GetUsernameOk returns a tuple with the Username field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUsername

`func (o *CreateDockerRegistry) SetUsername(v string)`

SetUsername sets Username field to given value.


### GetPassword

`func (o *CreateDockerRegistry) GetPassword() string`

GetPassword returns the Password field if non-nil, zero value otherwise.

### GetPasswordOk

`func (o *CreateDockerRegistry) GetPasswordOk() (*string, bool)`

GetPasswordOk returns a tuple with the Password field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPassword

`func (o *CreateDockerRegistry) SetPassword(v string)`

SetPassword sets Password field to given value.


### GetProject

`func (o *CreateDockerRegistry) GetProject() string`

GetProject returns the Project field if non-nil, zero value otherwise.

### GetProjectOk

`func (o *CreateDockerRegistry) GetProjectOk() (*string, bool)`

GetProjectOk returns a tuple with the Project field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetProject

`func (o *CreateDockerRegistry) SetProject(v string)`

SetProject sets Project field to given value.


### GetRegistryType

`func (o *CreateDockerRegistry) GetRegistryType() string`

GetRegistryType returns the RegistryType field if non-nil, zero value otherwise.

### GetRegistryTypeOk

`func (o *CreateDockerRegistry) GetRegistryTypeOk() (*string, bool)`

GetRegistryTypeOk returns a tuple with the RegistryType field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRegistryType

`func (o *CreateDockerRegistry) SetRegistryType(v string)`

SetRegistryType sets RegistryType field to given value.


### GetIsDefault

`func (o *CreateDockerRegistry) GetIsDefault() bool`

GetIsDefault returns the IsDefault field if non-nil, zero value otherwise.

### GetIsDefaultOk

`func (o *CreateDockerRegistry) GetIsDefaultOk() (*bool, bool)`

GetIsDefaultOk returns a tuple with the IsDefault field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIsDefault

`func (o *CreateDockerRegistry) SetIsDefault(v bool)`

SetIsDefault sets IsDefault field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


