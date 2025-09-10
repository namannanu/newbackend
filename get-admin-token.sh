#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== Admin Authentication Test ==========${NC}"

# Configuration
BASE_URL="http://localhost:3001"
EMAIL="admin@example.com"  # Replace with a valid admin email
PASSWORD="adminpassword"   # Replace with the admin password

# Step 1: Login to get a token
echo -e "${YELLOW}Step 1: Logging in as admin to get token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

echo "Login response:"
echo "$LOGIN_RESPONSE" | grep -v "token"
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get token. Check your credentials.${NC}"
  exit 1
fi

echo -e "${GREEN}Got token successfully!${NC}"
echo -e "${YELLOW}Your token (first 20 chars): ${TOKEN:0:20}...${NC}"

# Save token to a file for easy access
echo "$TOKEN" > admin_token.txt
echo -e "${GREEN}Token saved to admin_token.txt${NC}"
echo -e "You can use this token with: export ADMIN_TOKEN=\$(cat admin_token.txt)"

# Step 2: Verify the token works by checking admin status
echo -e "\n${YELLOW}Step 2: Verifying token...${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/auth/profile" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Profile response:"
echo "$PROFILE_RESPONSE" | grep -v "email\\|phone\\|password"

# Check if the response contains admin or superadmin role
if echo "$PROFILE_RESPONSE" | grep -q '"role":"admin"' || echo "$PROFILE_RESPONSE" | grep -q '"role":"superadmin"'; then
  echo -e "${GREEN}Token verified as admin/superadmin!${NC}"
  
  # Extract userId for convenience
  USER_ID=$(echo "$PROFILE_RESPONSE" | grep -o '"userId":"[^"]*' | sed 's/"userId":"//')
  echo "userId: $USER_ID"
  echo "$USER_ID" > admin_user_id.txt
  echo -e "${GREEN}Admin userId saved to admin_user_id.txt${NC}"
else
  echo -e "${RED}Token does not have admin permissions.${NC}"
fi

echo -e "\n${BLUE}========== Test Complete ==========${NC}"
echo -e "You can now use the token for testing admin endpoints:"
echo -e "${GREEN}export ADMIN_TOKEN=\$(cat admin_token.txt)${NC}"
