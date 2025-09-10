#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== Generate Test Admin Token ==========${NC}"

# Check if we can get JWT_SECRET from env file
ENV_FILE="./src/config/config.env"
if [ -f "$ENV_FILE" ]; then
    JWT_SECRET=$(grep JWT_SECRET "$ENV_FILE" | cut -d'=' -f2)
    if [ ! -z "$JWT_SECRET" ]; then
        echo -e "${GREEN}Found JWT_SECRET in config.env${NC}"
    else
        echo -e "${YELLOW}JWT_SECRET not found in config.env${NC}"
    fi
else
    echo -e "${YELLOW}Config file not found at $ENV_FILE${NC}"
fi

# Default secret if not found in env
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET="defaultsecretkey123456789"
    echo -e "${YELLOW}Using default secret for testing${NC}"
fi

# Install jq if not already installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}jq not found. Please install jq using:${NC}"
    echo "brew install jq"
    echo -e "${YELLOW}For now, we'll use a manual approach.${NC}"
    HAS_JQ=0
else
    HAS_JQ=1
fi

# Create token payload
USER_ID="test-admin-$(date +%s)"
ROLE="admin"
EXPIRY=$(($(date +%s) + 86400)) # 24 hours from now

echo -e "${YELLOW}Creating test token with:${NC}"
echo "userId: $USER_ID"
echo "role: $ROLE"
echo "expiry: $(date -r $EXPIRY)"

# Generate token using Node.js
NODE_SCRIPT=$(cat << EOF
const jwt = require('jsonwebtoken');
const payload = {
  userId: '$USER_ID',
  role: '$ROLE',
  iat: Math.floor(Date.now() / 1000),
  exp: $EXPIRY
};
const token = jwt.sign(payload, '$JWT_SECRET');
console.log(token);
EOF
)

# Check if Node.js is available
if command -v node &> /dev/null; then
    TOKEN=$(node -e "$NODE_SCRIPT" 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$TOKEN" ]; then
        echo -e "${GREEN}Successfully generated token using Node.js${NC}"
    else
        echo -e "${RED}Failed to generate token using Node.js${NC}"
        TOKEN=""
    fi
else
    echo -e "${RED}Node.js not found. Cannot generate token.${NC}"
    TOKEN=""
fi

# If token generation failed, give instructions
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Please create a token manually by:${NC}"
    echo "1. Using a JWT tool like https://jwt.io/"
    echo "2. Using the JWT_SECRET from your config"
    echo "3. Creating a payload with userId, role=admin, and exp"
    exit 1
fi

# Save the token
echo "$TOKEN" > test_admin_token.txt
echo -e "${GREEN}Token saved to test_admin_token.txt${NC}"

# Show how to use it
echo -e "\n${BLUE}========== Using the Token ==========${NC}"
echo -e "${YELLOW}To use this token in curl requests:${NC}"
echo -e "${GREEN}curl -H \"Authorization: Bearer $TOKEN\" http://localhost:3001/api/test-admin-url/ping${NC}"
echo ""
echo -e "${YELLOW}Or export it as an environment variable:${NC}"
echo -e "${GREEN}export ADMIN_TOKEN=\"$TOKEN\"${NC}"
