#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL - adjust if needed
BASE_URL="http://localhost:3001"

# Test user ID - replace this with a real user ID from your database
TEST_USER_ID="testuser123"

# Add your admin token here (from Postman or your login endpoint)
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}Testing Admin Access to User Images${NC}"
echo -e "${BLUE}==============================================${NC}"

echo -e "\n${YELLOW}► Step 1: Verify token decoding${NC}"
echo -e "The token should contain the admin userId and role."
echo -e "Token: ${ADMIN_TOKEN:0:15}...\n"

echo -e "${YELLOW}► Step 2: Testing admin access to user image info${NC}"
echo -e "Command: curl -s \"$BASE_URL/api/admin/user-image/$TEST_USER_ID\" -H \"Authorization: Bearer $ADMIN_TOKEN\""
ADMIN_IMAGE_INFO=$(curl -s "$BASE_URL/api/admin/user-image/$TEST_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$ADMIN_IMAGE_INFO" | grep -q "success"; then
  echo -e "${GREEN}✓ Success getting user image info as admin${NC}"
  echo "$ADMIN_IMAGE_INFO" | grep -v -E '^[[:space:]]*$'
else
  echo -e "${RED}✗ Failed getting user image info as admin${NC}"
  echo "$ADMIN_IMAGE_INFO"
fi

echo -e "\n${YELLOW}► Step 3: Testing admin signed URL generation${NC}"
echo -e "Command: curl -s \"$BASE_URL/api/s3/admin/signed-urls/$TEST_USER_ID\" -H \"Authorization: Bearer $ADMIN_TOKEN\""
ADMIN_SIGNED_URL=$(curl -s "$BASE_URL/api/s3/admin/signed-urls/$TEST_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$ADMIN_SIGNED_URL" | grep -q "success"; then
  echo -e "${GREEN}✓ Success getting signed URL for user image as admin${NC}"
  echo "$ADMIN_SIGNED_URL" | grep -v -E '^[[:space:]]*$'
else
  echo -e "${RED}✗ Failed getting signed URL for user image as admin${NC}"
  echo "$ADMIN_SIGNED_URL"
fi

echo -e "\n${YELLOW}► Step 4: Debug - Check route registration${NC}"
echo -e "Command: curl -s \"$BASE_URL/api/s3/_debug/routes\""
ROUTES=$(curl -s "$BASE_URL/api/s3/_debug/routes")
echo "$ROUTES" | grep -E '/admin|/s3/admin'

echo -e "\n${BLUE}==============================================${NC}"
echo -e "${BLUE}Testing Complete${NC}"
echo -e "${BLUE}==============================================${NC}"
