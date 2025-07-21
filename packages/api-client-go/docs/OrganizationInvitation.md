# OrganizationInvitation

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** | Invitation ID | 
**Email** | **string** | Email address of the user being invited | 
**InvitedBy** | **string** | Email address of the inviter | 
**OrganizationId** | **string** | Organization ID | 
**OrganizationName** | **string** | Organization name | 
**ExpiresAt** | **time.Time** | Expiration date of the invitation | 
**Status** | **string** | Invitation status | 
**Role** | **string** | Member role | 
**AssignedRoles** | [**[]OrganizationRole**](OrganizationRole.md) | Assigned roles | 
**CreatedAt** | **time.Time** | Creation timestamp | 
**UpdatedAt** | **time.Time** | Last update timestamp | 

## Methods

### NewOrganizationInvitation

`func NewOrganizationInvitation(id string, email string, invitedBy string, organizationId string, organizationName string, expiresAt time.Time, status string, role string, assignedRoles []OrganizationRole, createdAt time.Time, updatedAt time.Time, ) *OrganizationInvitation`

NewOrganizationInvitation instantiates a new OrganizationInvitation object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewOrganizationInvitationWithDefaults

`func NewOrganizationInvitationWithDefaults() *OrganizationInvitation`

NewOrganizationInvitationWithDefaults instantiates a new OrganizationInvitation object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *OrganizationInvitation) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *OrganizationInvitation) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *OrganizationInvitation) SetId(v string)`

SetId sets Id field to given value.


### GetEmail

`func (o *OrganizationInvitation) GetEmail() string`

GetEmail returns the Email field if non-nil, zero value otherwise.

### GetEmailOk

`func (o *OrganizationInvitation) GetEmailOk() (*string, bool)`

GetEmailOk returns a tuple with the Email field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEmail

`func (o *OrganizationInvitation) SetEmail(v string)`

SetEmail sets Email field to given value.


### GetInvitedBy

`func (o *OrganizationInvitation) GetInvitedBy() string`

GetInvitedBy returns the InvitedBy field if non-nil, zero value otherwise.

### GetInvitedByOk

`func (o *OrganizationInvitation) GetInvitedByOk() (*string, bool)`

GetInvitedByOk returns a tuple with the InvitedBy field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInvitedBy

`func (o *OrganizationInvitation) SetInvitedBy(v string)`

SetInvitedBy sets InvitedBy field to given value.


### GetOrganizationId

`func (o *OrganizationInvitation) GetOrganizationId() string`

GetOrganizationId returns the OrganizationId field if non-nil, zero value otherwise.

### GetOrganizationIdOk

`func (o *OrganizationInvitation) GetOrganizationIdOk() (*string, bool)`

GetOrganizationIdOk returns a tuple with the OrganizationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOrganizationId

`func (o *OrganizationInvitation) SetOrganizationId(v string)`

SetOrganizationId sets OrganizationId field to given value.


### GetOrganizationName

`func (o *OrganizationInvitation) GetOrganizationName() string`

GetOrganizationName returns the OrganizationName field if non-nil, zero value otherwise.

### GetOrganizationNameOk

`func (o *OrganizationInvitation) GetOrganizationNameOk() (*string, bool)`

GetOrganizationNameOk returns a tuple with the OrganizationName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOrganizationName

`func (o *OrganizationInvitation) SetOrganizationName(v string)`

SetOrganizationName sets OrganizationName field to given value.


### GetExpiresAt

`func (o *OrganizationInvitation) GetExpiresAt() time.Time`

GetExpiresAt returns the ExpiresAt field if non-nil, zero value otherwise.

### GetExpiresAtOk

`func (o *OrganizationInvitation) GetExpiresAtOk() (*time.Time, bool)`

GetExpiresAtOk returns a tuple with the ExpiresAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExpiresAt

`func (o *OrganizationInvitation) SetExpiresAt(v time.Time)`

SetExpiresAt sets ExpiresAt field to given value.


### GetStatus

`func (o *OrganizationInvitation) GetStatus() string`

GetStatus returns the Status field if non-nil, zero value otherwise.

### GetStatusOk

`func (o *OrganizationInvitation) GetStatusOk() (*string, bool)`

GetStatusOk returns a tuple with the Status field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStatus

`func (o *OrganizationInvitation) SetStatus(v string)`

SetStatus sets Status field to given value.


### GetRole

`func (o *OrganizationInvitation) GetRole() string`

GetRole returns the Role field if non-nil, zero value otherwise.

### GetRoleOk

`func (o *OrganizationInvitation) GetRoleOk() (*string, bool)`

GetRoleOk returns a tuple with the Role field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRole

`func (o *OrganizationInvitation) SetRole(v string)`

SetRole sets Role field to given value.


### GetAssignedRoles

`func (o *OrganizationInvitation) GetAssignedRoles() []OrganizationRole`

GetAssignedRoles returns the AssignedRoles field if non-nil, zero value otherwise.

### GetAssignedRolesOk

`func (o *OrganizationInvitation) GetAssignedRolesOk() (*[]OrganizationRole, bool)`

GetAssignedRolesOk returns a tuple with the AssignedRoles field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAssignedRoles

`func (o *OrganizationInvitation) SetAssignedRoles(v []OrganizationRole)`

SetAssignedRoles sets AssignedRoles field to given value.


### GetCreatedAt

`func (o *OrganizationInvitation) GetCreatedAt() time.Time`

GetCreatedAt returns the CreatedAt field if non-nil, zero value otherwise.

### GetCreatedAtOk

`func (o *OrganizationInvitation) GetCreatedAtOk() (*time.Time, bool)`

GetCreatedAtOk returns a tuple with the CreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedAt

`func (o *OrganizationInvitation) SetCreatedAt(v time.Time)`

SetCreatedAt sets CreatedAt field to given value.


### GetUpdatedAt

`func (o *OrganizationInvitation) GetUpdatedAt() time.Time`

GetUpdatedAt returns the UpdatedAt field if non-nil, zero value otherwise.

### GetUpdatedAtOk

`func (o *OrganizationInvitation) GetUpdatedAtOk() (*time.Time, bool)`

GetUpdatedAtOk returns a tuple with the UpdatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUpdatedAt

`func (o *OrganizationInvitation) SetUpdatedAt(v time.Time)`

SetUpdatedAt sets UpdatedAt field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


