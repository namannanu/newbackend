#!/bin/bash
# API Testing Script for Admin Image Access

# Configuration
API_BASE_URL="http://localhost:3001"
TOKEN=$(cat .token 2>/dev/null || echo "")
TARGET_USER_ID="USER-ID-TO-TEST"

# Check if token exists
if [ -z "$TOKEN" ]; then
  echo "❌ No token found in .token file. Let's get a token first."
  
  # Prompt for email/password
  read -p "Admin Email: " ADMIN_EMAIL
  read -s -p "Admin Password: " ADMIN_PASSWORD
  echo ""
  
  # Login to get token
  echo "🔑 Logging in to get admin token..."
  LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" \
    "$API_BASE_URL/api/auth/admin/login")
  
  # Extract token from response
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
  
  if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get token. Login response:"
    echo "$LOGIN_RESPONSE" | json_pp
    exit 1
  else
    echo "✅ Successfully got token"
    # Save token for future use
    echo "$TOKEN" > .token
  fi
fi

# Now prompt for user ID if not provided
if [ "$TARGET_USER_ID" = "USER-ID-TO-TEST" ]; then
  read -p "Enter User ID to test: " TARGET_USER_ID
fi

echo ""
echo "🔍 Testing with:"
echo "- API Base URL: $API_BASE_URL"
echo "- Admin Token: ${TOKEN:0:10}... (truncated)"
echo "- Target User ID: $TARGET_USER_ID"
echo ""

# Test 1: Basic debugging endpoint
echo "Test 1: Simple admin user image endpoint"
echo "---------------------------------------"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/api/admin/user-image/$TARGET_USER_ID" | json_pp
echo ""

# Test 2: Main admin signed URL endpoint
echo ""
echo "Test 2: Admin signed URL endpoint"
echo "--------------------------------"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/api/s3/admin/signed-urls/$TARGET_USER_ID" | json_pp
echo ""

# Test 3: Check token validity
echo ""
echo "Test 3: Verify token is valid"
echo "----------------------------"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/api/auth/validate-token" | json_pp
echo ""

# Test 4: List available routes
echo ""
echo "Test 4: List amplify routes"
echo "-------------------------"
curl -s "$API_BASE_URL/api/s3/_debug/routes" | json_pp
echo ""

# Test 5: Check AWS connection status
echo ""
echo "Test 5: Check AWS status"
echo "----------------------"
curl -s "$API_BASE_URL/api/aws-status" | json_pp
echo ""

echo "✅ Tests completed"
