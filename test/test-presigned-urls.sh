#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Your API base URL
API_URL="https://correct-eight.vercel.app"

# Replace with a valid JWT token
JWT_TOKEN="YOUR_JWT_TOKEN"

# Test cases
echo -e "${BLUE}Starting Presigned URL endpoint tests...${NC}\n"

# Test 1: Get by MongoDB _id
echo -e "${BLUE}Test 1: Getting presigned URLs by MongoDB _id${NC}"
curl -s -X GET \
  "${API_URL}/api/users/68a9902e4f0701bb871e1f3e/presigned-urls" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | json_pp

echo -e "\n-------------------\n"

# Test 2: Get by userId
echo -e "${BLUE}Test 2: Getting presigned URLs by userId${NC}"
curl -s -X GET \
  "${API_URL}/api/users/user-rgdr58npg-meo33m5p/presigned-urls" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | json_pp

echo -e "\n-------------------\n"

# Test 3: Test with non-existent user
echo -e "${BLUE}Test 3: Testing with non-existent user${NC}"
curl -s -X GET \
  "${API_URL}/api/users/nonexistent-user/presigned-urls" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | json_pp

echo -e "\n-------------------\n"

echo -e "${GREEN}Tests completed!${NC}"
