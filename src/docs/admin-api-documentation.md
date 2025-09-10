# Admin APIs Documentation

## Overview
The Admin APIs provide basic management capabilities for administrators to manage users, organizers, and view system analytics.

## Authentication
All admin endpoints require:
- **Authentication**: Bearer token in Authorization header
- **Authorization**: Valid admin credentials

## Base URL  
```
http://localhost:3000/api/admin
```

## User Management

### 1. Get All Users
**GET** `/users`

Retrieve all users in the system.

**Response:**
```json
{
  "status": "success",
  "results": 150,
  "data": {
    "users": [
      {
        "_id": "64a1b2c3d4e5f6789012345",
        "fullName": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "status": "active",
        "verificationStatus": "verified",
        "createdAt": "2025-07-21T10:00:00.000Z"
      }
    ]
  }
}
```

### 2. Update User Status
**PATCH** `/users/:id/status`

Update a user's status (active/suspended).

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "User status updated successfully",
  "data": {
    "user": {
      "_id": "64a1b2c3d4e5f6789012345",
      "fullName": "John Doe",
      "status": "suspended",
      "updatedAt": "2025-07-21T10:30:00.000Z"
    }
  }
}
```

## Organizer Management

### 1. Get All Organizers
**GET** `/organizers`

Retrieve all organizers in the system.

**Response:**
```json
{
  "status": "success",
  "results": 25,
  "data": {
    "organizers": [
      {
        "_id": "64a1b2c3d4e5f6789012347",
        "name": "Event Pro Corp",
        "email": "contact@eventpro.com",
        "phone": "+1234567890",
        "status": "active",
        "totalEvents": 15,
        "activeEvents": 3,
        "totalRevenue": 50000,
        "createdAt": "2025-06-15T10:00:00.000Z"
      }
    ]
  }
}
```

### 2. Update Organizer Status
**PATCH** `/organizers/:id/status`

Update an organizer's status (active/suspended/pending).

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Organizer status updated successfully",
  "data": {
    "organizer": {
      "_id": "64a1b2c3d4e5f6789012347",
      "name": "Event Pro Corp",
      "status": "suspended",
      "updatedAt": "2025-07-21T10:30:00.000Z"
    }
  }
}
```

## Analytics & Dashboard

### 1. Get Dashboard Stats
**GET** `/dashboard-stats`

Get comprehensive system statistics.

**Response:**
```json
{
  "status": "success",
  "data": {
    "stats": {
      "users": {
        "total": 1250,
        "active": 1180,
        "suspended": 70
      },
      "adminUsers": {
        "total": 5
      },
      "organizers": {
        "total": 120,
        "active": 110,
        "pending": 8,
        "suspended": 2
      },
      "events": {
        "total": 450,
        "upcoming": 85,
        "ongoing": 12,
        "completed": 353
      },
      "verification": {
        "pending": 45,
        "verified": 1150,
        "rejected": 55
      }
    }
  }
}
```

## Admin User Management

### 1. Create Admin User
**POST** `/admin-users`

Create a new admin user (can be standalone or linked to existing user).

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "adminPassword123",
  "userId": "64a1b2c3d4e5f6789012345" // Optional - link to existing user
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Admin user created successfully",
  "data": {
    "adminUser": {
      "_id": "64a1b2c3d4e5f6789012346",
      "email": "admin@example.com",
      "userId": "64a1b2c3d4e5f6789012345",
      "status": "active",
      "role": "admin",
      "createdAt": "2025-07-21T10:00:00.000Z",
      "updatedAt": "2025-07-21T10:00:00.000Z"
    }
  }
}
```

### 2. Get All Admin Users
**GET** `/admin-users`

Retrieve all admin users with populated user information.

**Response:**
```json
{
  "status": "success",
  "results": 5,
  "data": {
    "adminUsers": [
      {
        "_id": "64a1b2c3d4e5f6789012346",
        "email": "admin@example.com",
        "status": "active",
        "role": "admin",
        "userId": {
          "_id": "64a1b2c3d4e5f6789012345",
          "fullName": "John Admin",
          "email": "john@example.com",
          "phone": "+1234567890",
          "status": "active",
          "verificationStatus": "verified"
        },
        "createdAt": "2025-07-21T10:00:00.000Z"
      }
    ]
  }
}
```

### 3. Update Admin User
**PUT** `/admin-users/:id`

Update admin user status or link to a regular user.

**Request Body:**
```json
{
  "status": "inactive",
  "userId": "64a1b2c3d4e5f6789012345" // Optional - link to user
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Admin user updated successfully",
  "data": {
    "adminUser": {
      "_id": "64a1b2c3d4e5f6789012346",
      "email": "admin@example.com",
      "status": "inactive",
      "userId": {
        "_id": "64a1b2c3d4e5f6789012345",
        "fullName": "John Admin",
        "email": "john@example.com"
      },
      "updatedAt": "2025-07-21T10:30:00.000Z"
    }
  }
}
```

### 4. Delete Admin User
**DELETE** `/admin-users/:id`

Delete an admin user.

**Response:**
```json
{
  "status": "success",
  "message": "Admin user deleted successfully",
  "data": {
    "deletedAdminUser": {
      "_id": "64a1b2c3d4e5f6789012346",
      "email": "admin@example.com"
    }
  }
}
```

## Error Responses

### Validation Errors
```json
{
  "status": "fail",
  "data": {
    "error": "Validation failed",
    "message": "Invalid status value"
  }
}
```

### Authorization Errors
```json
{
  "status": "fail",
  "data": {
    "error": "Unauthorized",
    "message": "Admin access required"
  }
}
```

### Not Found Errors
```json
{
  "status": "error",
  "message": "No user found with that ID"
}
```

## Usage Examples

### Get All Users
```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer your-admin-token"
```

### Update User Status
```bash
curl -X PATCH http://localhost:3000/api/admin/users/64a1b2c3d4e5f6789012345/status \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended"
  }'
```

### Create Admin User
```bash
curl -X POST http://localhost:3000/api/admin/admin-users \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@example.com",
    "password": "adminPassword123"
  }'
```

### Create Admin User Linked to Existing User
```bash
curl -X POST http://localhost:3000/api/admin/admin-users \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "linkedadmin@example.com",
    "password": "adminPassword123",
    "userId": "64a1b2c3d4e5f6789012345"
  }'
```

### Get All Admin Users
```bash
curl -X GET http://localhost:3000/api/admin/admin-users \
  -H "Authorization: Bearer your-admin-token"
```

### Update Admin User
```bash
curl -X PUT http://localhost:3000/api/admin/admin-users/64a1b2c3d4e5f6789012346 \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive"
  }'
```

### Get Dashboard Statistics
```bash
curl -X GET http://localhost:3000/api/admin/dashboard-stats \
  -H "Authorization: Bearer your-admin-token"
```
