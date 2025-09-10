#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== Testing Modified Admin Signed URL Endpoint ==========${NC}"

# Configuration
BASE_URL="http://localhost:3001"
USER_ID=${1:-"kkuserid"}  # Use first argument or default to "kkuserid"

# If we have a token file, use it
if [ -f "test_admin_token.txt" ]; then
    ADMIN_TOKEN=$(cat test_admin_token.txt)
    echo -e "${GREEN}Found admin token in test_admin_token.txt${NC}"
else
    # Check if token is in environment variable
    if [ -z "$ADMIN_TOKEN" ]; then
        echo -e "${YELLOW}No admin token found. Please set the ADMIN_TOKEN environment variable or create a test_admin_token.txt file.${NC}"
        echo -e "${YELLOW}Will try without token (this will likely fail)${NC}"
    else
        echo -e "${GREEN}Using admin token from environment variable${NC}"
    fi
fi

echo -e "${YELLOW}Testing URLs for endpoint: /admin/signed-urls/:userId${NC}"
echo -e "Target user ID: ${USER_ID}"
echo ""

# Test various URL combinations, with and without auth
test_url() {
    local url="$1"
    local use_auth="$2"
    
    echo -e "${BLUE}Testing URL: ${url}${NC}"
    
    if [ "$use_auth" = true ] && [ ! -z "$ADMIN_TOKEN" ]; then
        echo -e "${GREEN}With authentication token:${NC}"
        echo -e "${YELLOW}curl -v -H \"Authorization: Bearer \$ADMIN_TOKEN\" \"${url}\"${NC}"
        curl -v -H "Authorization: Bearer $ADMIN_TOKEN" "$url" 2>&1 | grep -v "Authorization: Bearer"
    else
        echo -e "${RED}Without authentication token:${NC}"
        echo -e "${YELLOW}curl -v \"${url}\"${NC}"
        curl -v "$url" 2>&1
    fi
    
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
}

# Test 1: Without /s3/ prefix in URL
test_url "${BASE_URL}/api/admin/signed-urls/${USER_ID}" true
test_url "${BASE_URL}/api/admin/signed-urls/${USER_ID}" false

# Test 2: With /s3/ prefix in URL
test_url "${BASE_URL}/api/s3/admin/signed-urls/${USER_ID}" true
test_url "${BASE_URL}/api/s3/admin/signed-urls/${USER_ID}" false

# Test 3: Direct test endpoint
test_url "${BASE_URL}/admin/signed-urls/${USER_ID}" true

echo -e "\n${GREEN}========== Tests Complete ==========${NC}"
echo -e "${YELLOW}Review the results above to see which URL format works correctly.${NC}"
echo -e "${YELLOW}This will help determine if your route changes were applied correctly.${NC}"
