# Amplify API Testing with Postman

This folder contains Postman collection and environment files for testing the image upload, management, and admin functionality in the Amplify module.

## Files

- `amplify_api_tests.postman_collection.json` - Collection of API requests to test all endpoints
- `amplify_api_environment.postman_environment.json` - Environment variables for the collection

## Setup Instructions

1. **Import the collection and environment into Postman**
   - Open Postman
   - Click "Import" in the top left corner
   - Select both JSON files
   - Click "Import"

2. **Set environment variables**
   - Select the "Amplify API Testing" environment from the dropdown in the top right
   - Click the eye icon next to the environment dropdown to edit variables
   - Set the following variables:
     - `base_url` - The base URL of your API (default: http://localhost:3001)
     - `user_token` - JWT token for a regular user (get from login endpoint)
     - `admin_token` - JWT token for an admin user (get from admin login endpoint)
     - `userId` - User ID to test with (should match the user token)
     - `recognitionId` - Recognition ID for faceimage tests (optional)

3. **Get valid tokens**
   - Use your login endpoints to get valid tokens
   - For user token: `POST /api/auth/login` with email and password
   - For admin token: `POST /api/auth/admin-login` with email and password
   - Copy the token value from the response into the environment variables

## Testing Flow

1. **Start with Debug and Status endpoints**
   - Verify the server is running and AWS is configured correctly
   - Check S3 connection status

2. **Test User Image Management**
   - Upload an image for the current user
   - Retrieve information about the uploaded image
   - Get a signed URL to access the image
   - Delete the image if needed

3. **Test Admin Functionality**
   - List all uploads in memory
   - Get a specific user's image information
   - Generate signed URLs for any user's image

4. **Test FaceImage Integration**
   - Attach a face recognition ID to the current user
   - Retrieve face image information

## Troubleshooting

- **401 Unauthorized**: Check if your tokens are valid and not expired
- **404 Not Found**: Make sure the user ID exists and has an uploaded photo
- **500 Server Error**: Check server logs for detailed error information
