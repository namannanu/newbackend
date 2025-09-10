#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== Simple Route Test ==========${NC}"

# Configuration
BASE_URL="http://localhost:3001"
USER_ID="kkuserid"

# Test URLs without any authentication to see if routes are registered
echo -e "${YELLOW}Testing if routes are registered (will return 401 if registered):${NC}\n"

echo -e "${BLUE}1. Testing: ${BASE_URL}/api/admin/signed-urls/${USER_ID}${NC}"
curl -s -w "\nHTTP Status: %{http_code}\n" "${BASE_URL}/api/admin/signed-urls/${USER_ID}"
echo -e "\n"

echo -e "${BLUE}2. Testing: ${BASE_URL}/api/s3/admin/signed-urls/${USER_ID}${NC}"
curl -s -w "\nHTTP Status: %{http_code}\n" "${BASE_URL}/api/s3/admin/signed-urls/${USER_ID}"
echo -e "\n"

echo -e "${BLUE}3. Testing: ${BASE_URL}/api/health${NC}"
curl -s -w "\nHTTP Status: %{http_code}\n" "${BASE_URL}/api/health"
echo -e "\n"

echo -e "${GREEN}========== Test Complete ==========${NC}"
echo -e "${YELLOW}If routes are registered but need authentication, you'll see a 401 error.${NC}"
echo -e "${YELLOW}If routes don't exist at all, you'll see a 404 error.${NC}"
echo -e "${YELLOW}The health endpoint should return a 200 status if the server is running.${NC}"
