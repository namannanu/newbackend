# Admin API - Face Data Management

This document describes the API endpoints for managing face data in the system.

## Check Face Data for User

This API endpoint allows administrators to check if a user has face image data in the system.

### Request

- **URL:** `/api/admin/users/:userId/face-data`
- **Method:** `GET`
- **Authentication:** Required (Admin token)
- **URL Parameters:**
  - `userId` (required): The ID of the user to check face data for

### Headers

```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

### Response

#### Success Response (No Face Data)

- **Code:** 200 OK
- **Content Example:**

```json
{
  "status": "success",
  "message": "User has no face image data to remove",
  "data": {
    "user": {
      "userId": "kannuuserid",
      "fullName": "Kannu User",
      "email": "kannu@gmail.com",
      "hasFaceImage": false,
      "verificationStatus": "pending"
    }
  }
}
```

#### Success Response (Has Face Data)

- **Code:** 200 OK
- **Content Example:**

```json
{
  "status": "success",
  "message": "User has face image data that requires manual removal from faceimage table",
  "data": {
    "user": {
      "userId": "kannuuserid",
      "fullName": "Kannu User",
      "email": "kannu@gmail.com",
      "hasFaceImage": true,
      "verificationStatus": "pending"
    }
  }
}
```

#### Error Responses

- **Code:** 400 Bad Request
  - **Content:** `{ "status": "error", "message": "User ID is required" }`

- **Code:** 404 Not Found
  - **Content:** `{ "status": "error", "message": "No user found with ID: <userId>" }`

- **Code:** 401 Unauthorized
  - **Content:** `{ "status": "error", "message": "You are not logged in! Please log in to get access." }`

- **Code:** 403 Forbidden
  - **Content:** `{ "status": "error", "message": "You do not have permission to perform this action" }`

- **Code:** 500 Internal Server Error
  - **Content:** `{ "status": "error", "message": "Failed to remove faceId" }`

### Usage Example

```bash
curl -X DELETE \
  -H "Authorization: Bearer eyJhbGciOiJ..." \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/admin/users/kannuuserid/face-id
```

## Notes

- This endpoint is accessible only to users with admin role
- The operation sets the `faceId` flag to `false` in the user record
- This does not delete any actual face image data from the faceimage table
- All operations are logged for audit purposes
