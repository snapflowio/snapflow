# CreateUser

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** |  | 
**Name** | **string** |  | 
**Email** | Pointer to **string** |  | [optional] 
**EmailVerified** | Pointer to **bool** |  | [optional] 
**Role** | Pointer to **string** |  | [optional] 
**PersonalOrganizationQuota** | Pointer to [**CreateOrganizationQuota**](CreateOrganizationQuota.md) |  | [optional] 

## Methods

### NewCreateUser

`func NewCreateUser(id string, name string, ) *CreateUser`

NewCreateUser instantiates a new CreateUser object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateUserWithDefaults

`func NewCreateUserWithDefaults() *CreateUser`

NewCreateUserWithDefaults instantiates a new CreateUser object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *CreateUser) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *CreateUser) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *CreateUser) SetId(v string)`

SetId sets Id field to given value.


### GetName

`func (o *CreateUser) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *CreateUser) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *CreateUser) SetName(v string)`

SetName sets Name field to given value.


### GetEmail

`func (o *CreateUser) GetEmail() string`

GetEmail returns the Email field if non-nil, zero value otherwise.

### GetEmailOk

`func (o *CreateUser) GetEmailOk() (*string, bool)`

GetEmailOk returns a tuple with the Email field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEmail

`func (o *CreateUser) SetEmail(v string)`

SetEmail sets Email field to given value.

### HasEmail

`func (o *CreateUser) HasEmail() bool`

HasEmail returns a boolean if a field has been set.

### GetEmailVerified

`func (o *CreateUser) GetEmailVerified() bool`

GetEmailVerified returns the EmailVerified field if non-nil, zero value otherwise.

### GetEmailVerifiedOk

`func (o *CreateUser) GetEmailVerifiedOk() (*bool, bool)`

GetEmailVerifiedOk returns a tuple with the EmailVerified field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEmailVerified

`func (o *CreateUser) SetEmailVerified(v bool)`

SetEmailVerified sets EmailVerified field to given value.

### HasEmailVerified

`func (o *CreateUser) HasEmailVerified() bool`

HasEmailVerified returns a boolean if a field has been set.

### GetRole

`func (o *CreateUser) GetRole() string`

GetRole returns the Role field if non-nil, zero value otherwise.

### GetRoleOk

`func (o *CreateUser) GetRoleOk() (*string, bool)`

GetRoleOk returns a tuple with the Role field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRole

`func (o *CreateUser) SetRole(v string)`

SetRole sets Role field to given value.

### HasRole

`func (o *CreateUser) HasRole() bool`

HasRole returns a boolean if a field has been set.

### GetPersonalOrganizationQuota

`func (o *CreateUser) GetPersonalOrganizationQuota() CreateOrganizationQuota`

GetPersonalOrganizationQuota returns the PersonalOrganizationQuota field if non-nil, zero value otherwise.

### GetPersonalOrganizationQuotaOk

`func (o *CreateUser) GetPersonalOrganizationQuotaOk() (*CreateOrganizationQuota, bool)`

GetPersonalOrganizationQuotaOk returns a tuple with the PersonalOrganizationQuota field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPersonalOrganizationQuota

`func (o *CreateUser) SetPersonalOrganizationQuota(v CreateOrganizationQuota)`

SetPersonalOrganizationQuota sets PersonalOrganizationQuota field to given value.

### HasPersonalOrganizationQuota

`func (o *CreateUser) HasPersonalOrganizationQuota() bool`

HasPersonalOrganizationQuota returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


