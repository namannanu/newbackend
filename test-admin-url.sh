#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL - adjust if needed
BASE_URL="http://localhost:3001"

# Replace these with actual values - you'll need to get a valid admin token
# To get a token, use the login API and copy the token from the response
ADMIN_TOKEN="your_admin_token_here"
TARGET_USER_ID="kkuserid"

# Uncomment and run these exports before running this script if you prefer
# export ADMIN_TOKEN="your_admin_token_here"
# export TARGET_USER_ID="kkuserid"

# Use environment variables if set
[[ ! -z "$ADMIN_TOKEN" ]] && ADMIN_TOKEN=$ADMIN_TOKEN
[[ ! -z "$TARGET_USER_ID" ]] && TARGET_USER_ID=$TARGET_USER_ID

echo -e "${BLUE}========== Testing Admin Signed URL Endpoint ==========${NC}"

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed. Please install curl.${NC}"
    exit 1
fi

# Function to make requests
make_request() {
    local url="$1"
    local method="$2"
    local token="$3"
    local data="$4"
    
    echo -e "${YELLOW}Making ${method} request to: ${url}${NC}"
    
    if [[ -n "$data" ]]; then
        curl -s -X "$method" \
             -H "Authorization: Bearer ${token}" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$url"
    else
        curl -s -X "$method" \
             -H "Authorization: Bearer ${token}" \
             "$url"
    fi
    
    echo -e "\n"
}

# Step 1: Check if the server is running
echo -e "${YELLOW}Step 1: Checking if server is running...${NC}"
SERVER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/api/health)

if [[ "$SERVER_STATUS" == "200" ]]; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not running or not responding. Please start your server.${NC}"
    exit 1
fi

# Step 2: Check Amplify routes
echo -e "\n${YELLOW}Step 2: Checking Amplify router...${NC}"
ROUTER_PING=$(curl -s ${BASE_URL}/api/s3/test-ping)
echo -e "Response: $ROUTER_PING"

# Step 3: List all registered routes
echo -e "\n${YELLOW}Step 3: Listing all registered routes...${NC}"
ROUTES=$(curl -s ${BASE_URL}/api/s3/_debug/routes)
echo -e "Response: $ROUTES"

# Step 4: Test the simplified admin endpoint first
echo -e "\n${YELLOW}Step 4: Testing simplified admin endpoint...${NC}"
SIMPLE_RESULT=$(make_request "${BASE_URL}/api/admin/user-image/${TARGET_USER_ID}" "GET" "$ADMIN_TOKEN")
echo -e "Response: $SIMPLE_RESULT"

# Step 5: Test the admin signed URL endpoint
echo -e "\n${YELLOW}Step 5: Testing admin signed URL endpoint...${NC}"
RESULT=$(make_request "${BASE_URL}/api/s3/admin/signed-urls/${TARGET_USER_ID}" "GET" "$ADMIN_TOKEN")
echo -e "Response: $RESULT"

# Step 6: Test with verbose output
echo -e "\n${YELLOW}Step 6: Testing with verbose output...${NC}"
echo -e "Running: curl -v -H \"Authorization: Bearer \$ADMIN_TOKEN\" \"${BASE_URL}/api/s3/admin/signed-urls/${TARGET_USER_ID}\""
echo -e "${BLUE}--- BEGIN VERBOSE OUTPUT ---${NC}"
curl -v -H "Authorization: Bearer $ADMIN_TOKEN" "${BASE_URL}/api/s3/admin/signed-urls/${TARGET_USER_ID}" 2>&1
echo -e "\n${BLUE}--- END VERBOSE OUTPUT ---${NC}"

echo -e "\n${GREEN}========== Test Complete ==========${NC}"
