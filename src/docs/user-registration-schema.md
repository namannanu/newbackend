# User Event Registration Documentation

## Database Schema Relationship

This document outlines how the `UserEventRegistrations` and `Users` models are connected in the backend system, and provides guidance for frontend developers on how to utilize these connections.

### Schema Relationship

```
UserEventRegistrations [icon: check-circle, color: green] {
  registrationId string pk
  eventId string
  userId string
  registrationDate date
  status string
  checkInTime date
  waitingStatus string
  faceVerificationStatus string
  ticketAvailabilityStatus string
  verificationAttempts number
  lastVerificationAttempt date
  ticketIssued boolean
  ticketIssuedDate date
  adminBooked boolean
  adminOverrideReason string
}

Users [icon: user, color: yellow] {
  userId string pk
  FullName string
  email string unique
  password string
  phone string
  faceId string
  verificationStatus string
  status string
  createdAt date
  updatedAt date
}
```

**Connection**: `UserEventRegistrations.userId > Users.userId`

## Technical Implementation

In our MongoDB/Mongoose implementation, this connection is established through the following schema definition:

```javascript
// From userEventRegistration.model.js
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true
}
```

The connection is a document reference relationship where:
1. The `UserEventRegistration` document stores the MongoDB ObjectId of the related `User` document
2. The system enforces a unique compound index on `eventId` and `userId` to prevent duplicate registrations:

```javascript
userEventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
```

### Field Mapping: Backend to Frontend

When integrating the backend with the Flutter frontend, note the following field mappings:

| Backend Field (MongoDB) | Frontend Field (Flutter) | Notes |
|------------------------|--------------------------|-------|
| `_id` | `id` | MongoDB uses _id, Flutter uses id |
| `fullName` | `username` | Different naming conventions |
| `email` | `email` | Direct mapping |
| `avatar` | `avatar` / `profileImageUrl` | Available via getter |
| `faceId` | `faceId` | Direct mapping |
| `verificationStatus` | `verificationStatus` | Direct mapping |
| `phone` | N/A | Not currently used in frontend |
| `registrationId` | `registrationId` | Direct mapping |
| `status` | `status` | Direct mapping |

The frontend models include compatibility getters to handle these differences without changing the API response structure.

## API Endpoints for Frontend Integration

The backend provides the following endpoints to work with user registrations:

### 1. Get User's Registrations
```
GET /api/registrations/user/:userId
```
Returns all event registrations for a specific user with populated event data.

### 2. Create a Registration (Buy Ticket)
```
POST /api/registrations
```
Body:
```json
{
  "userId": "user-id-here",
  "eventId": "event-id-here"
}
```

### 3. Check Registration Status
```
GET /api/registrations/:id
```
Returns details of a specific registration.

### 4. Update Registration
```
PUT /api/registrations/:id
```
Updates registration details.

### 5. Face Verification
```
PUT /api/registrations/:id/face-verification/start
PUT /api/registrations/:id/face-verification/complete
```
Handles the face verification process.

### 6. Check-in User
```
PUT /api/registrations/:id/checkin
```
Marks a user as checked in for an event.

### 7. Issue Ticket
```
PUT /api/registrations/:id/issue-ticket
```
Issues a ticket for a registration.

## Frontend Implementation 

### Flutter User Model

The frontend Flutter application uses the following model to represent users from the backend:

```dart
class UserModel {
  final String id;
  final String username;
  final String email;
  final String? avatar;
  final DateTime? createdAt;
  final String? faceId;  // Added faceId field to match schema
  final String? verificationStatus; // Added verification status

  UserModel({
    required this.id,
    required this.username,
    required this.email,
    this.avatar,
    this.createdAt,
    this.faceId,
    this.verificationStatus,
  });

  String get fullName => username;

  // Compatibility getters for UI that expects firstName/lastName
  String get firstName => username; // Use username as firstName for now
  String get lastName => ''; // Empty for now since we only have username
  String? get profileImageUrl => avatar; // Map avatar to profileImageUrl
  String get phoneNumber => ''; // Empty for now since backend doesn't have this

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] ?? json['id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      avatar: json['avatar'],
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'])
          : null,
      faceId: json['faceId'],
      verificationStatus: json['verificationStatus'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'avatar': avatar,
      'createdAt': createdAt?.toIso8601String(),
      'faceId': faceId,
      'verificationStatus': verificationStatus,
    };
  }
}
```

**Note:** The frontend model uses `username` field while the backend uses `fullName`. The `UserModel.fromJson` method should be updated to properly map these fields when integrating with the backend API.

### Implementation Examples

#### Retrieving User's Registrations

```javascript
// Frontend code example
async function getUserRegistrations(userId) {
  const response = await fetch(`/api/registrations/user/${userId}`);
  const data = await response.json();
  return data.data.registrations; // Array of registrations with event details
}
```

### Creating a New Registration (Buying a Ticket)

```javascript
// Frontend code example
async function buyTicket(userId, eventId) {
  const response = await fetch('/api/registrations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: userId,  // The logged-in user's ID
      eventId: eventId // The event they want to register for
    }),
  });
  return await response.json();
}
```

### Checking Registration Status

```javascript
// Frontend code example
async function checkRegistrationStatus(userId, eventId) {
  const response = await fetch(`/api/registrations/user/${userId}`);
  const data = await response.json();
  const registration = data.data.registrations.find(reg => reg.eventId._id === eventId);
  return registration ? registration.status : 'not-registered';
}
```

### Complete Ticket Purchase Flow

```javascript
// 1. User selects an event to attend
function selectEvent(eventId) {
  // Store the selected event ID
  currentEventId = eventId;
  
  // Show ticket purchase UI
  showTicketPurchaseUI();
}

// 2. User confirms purchase
async function confirmPurchase() {
  try {
    // Get the current user ID from auth context/storage
    const userId = getCurrentUserId();
    
    // Call the API to create a registration
    const result = await buyTicket(userId, currentEventId);
    
    if (result.status === 'success') {
      // Show confirmation and next steps for face verification
      showPurchaseConfirmation();
      // Redirect to face verification flow
      redirectToFaceVerification(result.data.registration.registrationId);
    } else {
      // Handle errors
      showErrorMessage(result.message);
    }
  } catch (error) {
    console.error('Failed to purchase ticket:', error);
    showErrorMessage('Failed to purchase ticket. Please try again.');
  }
}

// 3. Face verification process
async function startFaceVerification(registrationId) {
  // Start the verification process
  await fetch(`/api/registrations/${registrationId}/face-verification/start`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      faceVerificationId: 'some-verification-id'
    })
  });
  
  // Frontend captures face image and sends to API
  // ...

  // Complete verification
  const result = await fetch(`/api/registrations/${registrationId}/face-verification/complete`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true
    })
  });
  
  if (result.status === 'success') {
    // Show ticket
    showTicket(registrationId);
  }
}
```

## Detailed Data Flow

1. **User Authentication**
   - User logs in and receives authentication token
   - Frontend stores userId for ticket purchase

2. **Event Selection**
   - User browses events and selects one to attend
   - Frontend passes eventId and userId to backend

3. **Registration Creation**
   - Backend creates registration linking user and event
   - Registration starts in 'pending' status

4. **Face Verification**
   - User completes face verification process
   - Registration updated with verification result

5. **Ticket Issuance**
   - Upon successful verification, ticket is issued
   - Frontend can display ticket details

6. **Event Check-in**
   - At event venue, user is checked in
   - Registration status is updated to 'verified'

## Special Considerations

1. **User Verification Status**
   - Users must have verificationStatus = 'verified' to complete certain registration steps

2. **Duplicate Registrations**
   - System prevents users from registering for the same event twice

3. **Admin Overrides**
   - Admins can book on behalf of users using the adminBooked flag

4. **Face Verification Process**
   - Registration tracks verification attempts and statuses

## Flutter Implementation

### Registration Model

To complete the frontend implementation, a corresponding Flutter model for registrations should be created:

```dart
class EventRegistrationModel {
  final String id;
  final String registrationId;
  final String eventId;
  final String userId;
  final DateTime registrationDate;
  final String status;
  final DateTime? checkInTime;
  final String waitingStatus;
  final String faceVerificationStatus;
  final String ticketAvailabilityStatus;
  final int verificationAttempts;
  final DateTime? lastVerificationAttempt;
  final bool ticketIssued;
  final DateTime? ticketIssuedDate;
  final bool adminBooked;
  final String? adminOverrideReason;
  
  // Populated fields from related models
  final UserModel? user;
  final EventModel? event;

  EventRegistrationModel({
    required this.id,
    required this.registrationId,
    required this.eventId,
    required this.userId,
    required this.registrationDate,
    required this.status,
    this.checkInTime,
    required this.waitingStatus,
    required this.faceVerificationStatus,
    required this.ticketAvailabilityStatus,
    required this.verificationAttempts,
    this.lastVerificationAttempt,
    required this.ticketIssued,
    this.ticketIssuedDate,
    required this.adminBooked,
    this.adminOverrideReason,
    this.user,
    this.event,
  });
  
  factory EventRegistrationModel.fromJson(Map<String, dynamic> json) {
    return EventRegistrationModel(
      id: json['_id'] ?? '',
      registrationId: json['registrationId'] ?? '',
      eventId: json['eventId']?._id ?? json['eventId'] ?? '',
      userId: json['userId']?._id ?? json['userId'] ?? '',
      registrationDate: json['registrationDate'] != null 
          ? DateTime.parse(json['registrationDate']) 
          : DateTime.now(),
      status: json['status'] ?? 'pending',
      checkInTime: json['checkInTime'] != null 
          ? DateTime.parse(json['checkInTime']) 
          : null,
      waitingStatus: json['waitingStatus'] ?? 'queued',
      faceVerificationStatus: json['faceVerificationStatus'] ?? 'pending',
      ticketAvailabilityStatus: json['ticketAvailabilityStatus'] ?? 'pending',
      verificationAttempts: json['verificationAttempts'] ?? 0,
      lastVerificationAttempt: json['lastVerificationAttempt'] != null 
          ? DateTime.parse(json['lastVerificationAttempt']) 
          : null,
      ticketIssued: json['ticketIssued'] ?? false,
      ticketIssuedDate: json['ticketIssuedDate'] != null 
          ? DateTime.parse(json['ticketIssuedDate']) 
          : null,
      adminBooked: json['adminBooked'] ?? false,
      adminOverrideReason: json['adminOverrideReason'],
      user: json['userId'] is Map ? UserModel.fromJson(json['userId']) : null,
      event: json['eventId'] is Map ? EventModel.fromJson(json['eventId']) : null,
    );
  }
}
```

## Error Handling

Frontend should handle these common error scenarios:

1. **User Already Registered**
   - Status 400 with message about duplicate registration

2. **Event Full**
   - Status 400 with message about event capacity

3. **Face Verification Failed**
   - Status 400 with message about verification failure

4. **Invalid User or Event ID**
   - Status 400 with message about invalid IDs

## Data Population

When requesting registration data, the backend automatically populates:

1. User fields: fullName, email, phone
2. Event fields: name, date, location

This reduces the need for separate API calls to get user and event details.
