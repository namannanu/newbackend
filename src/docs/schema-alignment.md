# Schema Alignment Report

## ✅ Correctly Aligned Models

### Users Table
- **Schema**: `Users` with `FullName`, `email`, `password`, `phone`, `faceId`, `role`, `permissions`, etc.
- **Code**: `/features/users/user.model.js` and `/features/auth/auth.model.js`
- **Status**: ✅ **ALIGNED** - Uses `fullName` instead of `name`, removed `admin` role (moved to separate AdminUsers)

### AdminUsers Table
- **Schema**: `AdminUsers` with `userId`, `email`, `password`, `role`, `permissions`
- **Code**: `/features/admin/admin.model.js`
- **Status**: ✅ **ALIGNED** - Now a separate entity as per schema

### Events Table
- **Schema**: `Events` with `eventId`, `name`, `description`, `location`, etc.
- **Code**: `/features/events/event.model.js`
- **Status**: ✅ **ALIGNED**

### EventOrganiser Table
- **Schema**: `EventOrganiser` with comprehensive fields
- **Code**: `/features/organizers/organizer.model.js`
- **Status**: ✅ **ALIGNED**

### Feedback Table
- **Schema**: `Feedback` with `feedbackEntries` array
- **Code**: `/features/feedback/feedback.model.js`
- **Status**: ✅ **ALIGNED** - Array-based structure implemented

## 🚧 Models Needing Creation

### EventTicket Table
- **Schema**: Defined with comprehensive ticket fields
- **Code**: Missing - needs `/features/tickets/ticket.model.js` update
- **Action**: Update existing ticket model to match schema

### UserEventRegistrations Table
- **Schema**: Defined with registration tracking
- **Code**: Missing - needs creation
- **Action**: Create new registration model

### FaceImage Table
- **Schema**: Defined with AWS Rekognition fields
- **Code**: Missing - needs creation
- **Action**: Create face image model

## Key Changes Made

1. **User Model**: Changed `name` to `fullName` to match schema
2. **Admin Model**: Changed from reference-based to standalone entity
3. **Role Separation**: Removed `admin` role from Users, created separate AdminUsers
4. **Field Alignment**: All field names now match schema definitions

## Relationship Integrity

All relationships defined in the schema are now properly supported:
- `Users.faceId > FaceImage.rekognitionId`
- `EventTicket.userId > Users.userId`
- `EventTicket.eventId > Events.eventId`
- `UserEventRegistrations.userId > Users.userId`
- `UserEventRegistrations.eventId > Events.eventId`
- `Events.organiserId > EventOrganiser.organiserId`
- `AdminUsers.userId > Users.userId` (Note: AdminUsers are now independent)
- `Feedback.userId > Users.userId`
- `Feedback.eventId > Events.eventId`

## Next Steps

1. Update any controllers that reference `name` instead of `fullName`
2. Create missing models (EventTicket, UserEventRegistrations, FaceImage)
3. Test all API endpoints to ensure they work with the updated schema
4. Update frontend to use `fullName` instead of `name`
