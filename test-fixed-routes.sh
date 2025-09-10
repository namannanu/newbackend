#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== Testing Admin URL Endpoint (Fixed Version) ==========${NC}"

# Configuration
BASE_URL="http://localhost:3001"
USER_ID="kkuserid"

# Get admin token if available
ADMIN_TOKEN=${ADMIN_TOKEN:-$(cat admin_token.txt 2>/dev/null || echo "")}

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${YELLOW}No admin token found. Running with no authentication (will fail).${NC}"
    echo -e "${YELLOW}To get a token, configure get-admin-token.sh with proper credentials and run it.${NC}"
    echo ""
fi

echo -e "${YELLOW}Testing two possible URL formats:${NC}"
echo ""

# Test the URL without /s3 prefix
echo -e "${BLUE}1. Testing URL without /s3 prefix: ${BASE_URL}/api/admin/signed-urls/${USER_ID}${NC}"
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo -e "${GREEN}With authentication token:${NC}"
    curl -v -H "Authorization: Bearer $ADMIN_TOKEN" "${BASE_URL}/api/admin/signed-urls/${USER_ID}"
    echo ""
else
    echo -e "${RED}No auth token, testing without (will likely fail):${NC}"
    curl -v "${BASE_URL}/api/admin/signed-urls/${USER_ID}"
    echo ""
fi

# Test the URL with /s3 prefix
echo -e "\n${BLUE}2. Testing URL with /s3 prefix: ${BASE_URL}/api/s3/admin/signed-urls/${USER_ID}${NC}"
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo -e "${GREEN}With authentication token:${NC}"
    curl -v -H "Authorization: Bearer $ADMIN_TOKEN" "${BASE_URL}/api/s3/admin/signed-urls/${USER_ID}"
    echo ""
else
    echo -e "${RED}No auth token, testing without (will likely fail):${NC}"
    curl -v "${BASE_URL}/api/s3/admin/signed-urls/${USER_ID}"
    echo ""
fi

echo -e "\n${BLUE}========== Test Complete ==========${NC}"
echo -e "${YELLOW}If both URLs still fail, it could be because:${NC}"
echo "1. You need a valid admin token"
echo "2. The server needs to be restarted after making changes"
echo "3. There's another issue with the path or route configuration"
