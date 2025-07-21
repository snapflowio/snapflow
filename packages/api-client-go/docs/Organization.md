# Organization

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** | Organization ID | 
**Name** | **string** | Organization name | 
**CreatedBy** | **string** | The id of the organization creator | 
**Personal** | **bool** | Personal organization flag | 
**CreatedAt** | **time.Time** | Creation timestamp | 
**UpdatedAt** | **time.Time** | Last update timestamp | 
**Suspended** | **bool** | Suspended flag | 
**SuspendedAt** | **time.Time** | Suspended at | 
**SuspensionReason** | **string** | Suspended reason | 
**SuspendedUntil** | **time.Time** | Suspended until | 

## Methods

### NewOrganization

`func NewOrganization(id string, name string, createdBy string, personal bool, createdAt time.Time, updatedAt time.Time, suspended bool, suspendedAt time.Time, suspensionReason string, suspendedUntil time.Time, ) *Organization`

NewOrganization instantiates a new Organization object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewOrganizationWithDefaults

`func NewOrganizationWithDefaults() *Organization`

NewOrganizationWithDefaults instantiates a new Organization object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *Organization) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *Organization) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *Organization) SetId(v string)`

SetId sets Id field to given value.


### GetName

`func (o *Organization) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *Organization) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *Organization) SetName(v string)`

SetName sets Name field to given value.


### GetCreatedBy

`func (o *Organization) GetCreatedBy() string`

GetCreatedBy returns the CreatedBy field if non-nil, zero value otherwise.

### GetCreatedByOk

`func (o *Organization) GetCreatedByOk() (*string, bool)`

GetCreatedByOk returns a tuple with the CreatedBy field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedBy

`func (o *Organization) SetCreatedBy(v string)`

SetCreatedBy sets CreatedBy field to given value.


### GetPersonal

`func (o *Organization) GetPersonal() bool`

GetPersonal returns the Personal field if non-nil, zero value otherwise.

### GetPersonalOk

`func (o *Organization) GetPersonalOk() (*bool, bool)`

GetPersonalOk returns a tuple with the Personal field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPersonal

`func (o *Organization) SetPersonal(v bool)`

SetPersonal sets Personal field to given value.


### GetCreatedAt

`func (o *Organization) GetCreatedAt() time.Time`

GetCreatedAt returns the CreatedAt field if non-nil, zero value otherwise.

### GetCreatedAtOk

`func (o *Organization) GetCreatedAtOk() (*time.Time, bool)`

GetCreatedAtOk returns a tuple with the CreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedAt

`func (o *Organization) SetCreatedAt(v time.Time)`

SetCreatedAt sets CreatedAt field to given value.


### GetUpdatedAt

`func (o *Organization) GetUpdatedAt() time.Time`

GetUpdatedAt returns the UpdatedAt field if non-nil, zero value otherwise.

### GetUpdatedAtOk

`func (o *Organization) GetUpdatedAtOk() (*time.Time, bool)`

GetUpdatedAtOk returns a tuple with the UpdatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUpdatedAt

`func (o *Organization) SetUpdatedAt(v time.Time)`

SetUpdatedAt sets UpdatedAt field to given value.


### GetSuspended

`func (o *Organization) GetSuspended() bool`

GetSuspended returns the Suspended field if non-nil, zero value otherwise.

### GetSuspendedOk

`func (o *Organization) GetSuspendedOk() (*bool, bool)`

GetSuspendedOk returns a tuple with the Suspended field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuspended

`func (o *Organization) SetSuspended(v bool)`

SetSuspended sets Suspended field to given value.


### GetSuspendedAt

`func (o *Organization) GetSuspendedAt() time.Time`

GetSuspendedAt returns the SuspendedAt field if non-nil, zero value otherwise.

### GetSuspendedAtOk

`func (o *Organization) GetSuspendedAtOk() (*time.Time, bool)`

GetSuspendedAtOk returns a tuple with the SuspendedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuspendedAt

`func (o *Organization) SetSuspendedAt(v time.Time)`

SetSuspendedAt sets SuspendedAt field to given value.


### GetSuspensionReason

`func (o *Organization) GetSuspensionReason() string`

GetSuspensionReason returns the SuspensionReason field if non-nil, zero value otherwise.

### GetSuspensionReasonOk

`func (o *Organization) GetSuspensionReasonOk() (*string, bool)`

GetSuspensionReasonOk returns a tuple with the SuspensionReason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuspensionReason

`func (o *Organization) SetSuspensionReason(v string)`

SetSuspensionReason sets SuspensionReason field to given value.


### GetSuspendedUntil

`func (o *Organization) GetSuspendedUntil() time.Time`

GetSuspendedUntil returns the SuspendedUntil field if non-nil, zero value otherwise.

### GetSuspendedUntilOk

`func (o *Organization) GetSuspendedUntilOk() (*time.Time, bool)`

GetSuspendedUntilOk returns a tuple with the SuspendedUntil field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuspendedUntil

`func (o *Organization) SetSuspendedUntil(v time.Time)`

SetSuspendedUntil sets SuspendedUntil field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


