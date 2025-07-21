# UpdateOrganizationRole

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | **string** | The name of the role | 
**Description** | **string** | The description of the role | 
**Permissions** | **[]string** | The list of permissions assigned to the role | 

## Methods

### NewUpdateOrganizationRole

`func NewUpdateOrganizationRole(name string, description string, permissions []string, ) *UpdateOrganizationRole`

NewUpdateOrganizationRole instantiates a new UpdateOrganizationRole object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewUpdateOrganizationRoleWithDefaults

`func NewUpdateOrganizationRoleWithDefaults() *UpdateOrganizationRole`

NewUpdateOrganizationRoleWithDefaults instantiates a new UpdateOrganizationRole object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *UpdateOrganizationRole) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *UpdateOrganizationRole) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *UpdateOrganizationRole) SetName(v string)`

SetName sets Name field to given value.


### GetDescription

`func (o *UpdateOrganizationRole) GetDescription() string`

GetDescription returns the Description field if non-nil, zero value otherwise.

### GetDescriptionOk

`func (o *UpdateOrganizationRole) GetDescriptionOk() (*string, bool)`

GetDescriptionOk returns a tuple with the Description field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDescription

`func (o *UpdateOrganizationRole) SetDescription(v string)`

SetDescription sets Description field to given value.


### GetPermissions

`func (o *UpdateOrganizationRole) GetPermissions() []string`

GetPermissions returns the Permissions field if non-nil, zero value otherwise.

### GetPermissionsOk

`func (o *UpdateOrganizationRole) GetPermissionsOk() (*[]string, bool)`

GetPermissionsOk returns a tuple with the Permissions field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPermissions

`func (o *UpdateOrganizationRole) SetPermissions(v []string)`

SetPermissions sets Permissions field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


