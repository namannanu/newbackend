#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL - adjust if needed
BASE_URL="http://localhost:3001"

# Test user ID - replace with a valid user ID from your database
TEST_USER_ID="testuser123"

# Admin token - replace with a valid admin token
# You can get this by logging in as an admin and copying the token
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# User token - replace with a valid user token
USER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}API Testing Script for Image Management API${NC}"
echo -e "${BLUE}===============================================${NC}"

# Function to print section headers
section() {
  echo -e "\n${YELLOW}► $1${NC}"
}

# Function to test an endpoint
test_endpoint() {
  ENDPOINT=$1
  METHOD=${2:-"GET"}
  TOKEN=${3:-""}
  DATA=${4:-""}
  DESCRIPTION=${5:-"Testing $ENDPOINT"}
  
  echo -e "${BLUE}$DESCRIPTION${NC}"
  
  # Build curl command based on parameters
  CURL_CMD="curl -s -X $METHOD \"$BASE_URL$ENDPOINT\" -H \"Accept: application/json\""
  
  if [ ! -z "$TOKEN" ]; then
    CURL_CMD="$CURL_CMD -H \"Authorization: Bearer $TOKEN\""
  fi
  
  if [ ! -z "$DATA" ]; then
    CURL_CMD="$CURL_CMD -H \"Content-Type: application/json\" -d '$DATA'"
  fi
  
  echo "Command: $CURL_CMD"
  
  # Execute the curl command and capture output
  OUTPUT=$(eval $CURL_CMD)
  
  # Check if output is valid JSON
  if echo "$OUTPUT" | jq -e . >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Response is valid JSON${NC}"
    echo "$OUTPUT" | jq .
  else
    echo -e "${RED}✗ Invalid JSON response${NC}"
    echo "$OUTPUT"
  fi
  echo -e "${BLUE}---------------------------------------------${NC}"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install jq to parse JSON responses.${NC}"
    echo -e "You can install it with: brew install jq"
    exit 1
fi

# Start testing
section "1. Testing basic health endpoint"
test_endpoint "/api/health" "GET" "" "" "Health check"

section "2. Testing amplify router basic endpoints"
test_endpoint "/api/s3/test-ping" "GET" "" "" "Testing amplify router ping"
test_endpoint "/api/s3/_debug/routes" "GET" "" "" "Listing all amplify routes"

section "3. Testing AWS connectivity"
test_endpoint "/api/aws-status" "GET" "" "" "Checking AWS status"
test_endpoint "/api/test-s3-connection" "GET" "" "" "Testing S3 connection"

section "4. Testing user image endpoints with user token"
test_endpoint "/api/my-upload" "GET" "$USER_TOKEN" "" "Get my uploaded image info"
test_endpoint "/api/retrieve-image" "GET" "$USER_TOKEN" "" "Get my image URL"
test_endpoint "/api/get-image-status/$TEST_USER_ID" "GET" "$USER_TOKEN" "" "Check image status for user"
test_endpoint "/api/my-signed-url" "GET" "$USER_TOKEN" "" "Get signed URL for my image"

section "5. Testing admin endpoints with admin token"
test_endpoint "/api/admin/user-image/$TEST_USER_ID" "GET" "$ADMIN_TOKEN" "" "Get user image info as admin (simplified endpoint)"
test_endpoint "/api/s3/admin/signed-urls/$TEST_USER_ID" "GET" "$ADMIN_TOKEN" "" "Get signed URL for user image as admin"
test_endpoint "/api/admin/uploads" "GET" "$ADMIN_TOKEN" "" "List all uploads as admin"

section "6. Testing faceimage endpoints"
test_endpoint "/api/faceimage/rekognition123" "GET" "$ADMIN_TOKEN" "" "Get faceimage by RekognitionId"
test_endpoint "/api/faceimage/path/rekognition123" "GET" "$ADMIN_TOKEN" "" "Get faceimage path"

echo -e "\n${GREEN}===============================================${NC}"
echo -e "${GREEN}Testing Complete${NC}"
echo -e "${GREEN}===============================================${NC}"
