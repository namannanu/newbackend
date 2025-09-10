#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3001"
API_PREFIX="/api"

# Use environment variables if set, otherwise default values
ADMIN_TOKEN=${ADMIN_TOKEN:-$(cat admin_token.txt 2>/dev/null || echo "")}
USER_TOKEN=${USER_TOKEN:-$(cat user_token.txt 2>/dev/null || echo "")}
TARGET_USER_ID=${TARGET_USER_ID:-$(cat test_user_id.txt 2>/dev/null || echo "kkuserid")}

# Check if tokens are available
if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}No admin token found. Please run get-admin-token.sh first or set ADMIN_TOKEN environment variable.${NC}"
    echo -e "${YELLOW}Continuing without admin token - some tests will fail.${NC}"
fi

if [ -z "$USER_TOKEN" ]; then
    echo -e "${YELLOW}No user token found. Some tests may fail.${NC}"
fi

echo -e "${BLUE}========== Amplify Routes API Test ==========${NC}"
echo -e "Testing against: ${BASE_URL}${API_PREFIX}"
echo -e "Admin token: ${ADMIN_TOKEN:0:15}... (${#ADMIN_TOKEN} chars)"
echo -e "User token: ${USER_TOKEN:0:15}... (${#USER_TOKEN} chars)"
echo -e "Target user ID: ${TARGET_USER_ID}"

# Function to make API requests
make_request() {
    local url="$1"
    local method="$2"
    local token="$3"
    local data="$4"
    
    echo -e "${YELLOW}Making ${method} request to: ${url}${NC}"
    
    local curl_cmd="curl -s -X ${method}"
    
    if [ ! -z "$token" ]; then
        curl_cmd="${curl_cmd} -H \"Authorization: Bearer ${token}\""
    fi
    
    if [ ! -z "$data" ]; then
        curl_cmd="${curl_cmd} -H \"Content-Type: application/json\" -d '${data}'"
    fi
    
    curl_cmd="${curl_cmd} \"${url}\""
    
    echo -e "${BLUE}Command: ${curl_cmd}${NC}"
    
    if [ ! -z "$data" ]; then
        if [ ! -z "$token" ]; then
            curl -s -X "$method" \
                -H "Authorization: Bearer ${token}" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$url"
        else
            curl -s -X "$method" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$url"
        fi
    else
        if [ ! -z "$token" ]; then
            curl -s -X "$method" \
                -H "Authorization: Bearer ${token}" \
                "$url"
        else
            curl -s -X "$method" "$url"
        fi
    fi
    
    echo -e "\n"
}

# Test 1: Check ping endpoint (no auth required)
echo -e "\n${BLUE}Test 1: Check ping endpoint${NC}"
make_request "${BASE_URL}${API_PREFIX}/s3/test-ping" "GET"

# Test 2: List routes (no auth required)
echo -e "\n${BLUE}Test 2: List routes${NC}"
make_request "${BASE_URL}${API_PREFIX}/s3/_debug/routes" "GET"

# Test 3: Check AWS status (no auth required)
echo -e "\n${BLUE}Test 3: Check AWS status${NC}"
make_request "${BASE_URL}${API_PREFIX}/aws-status" "GET"

# Test 4: Test S3 connection (no auth required)
echo -e "\n${BLUE}Test 4: Test S3 connection${NC}"
make_request "${BASE_URL}${API_PREFIX}/test-s3-connection" "GET"

# Test 5: Simple user image status (requires user token)
if [ ! -z "$USER_TOKEN" ]; then
    echo -e "\n${BLUE}Test 5: Get my upload info (user)${NC}"
    make_request "${BASE_URL}${API_PREFIX}/my-upload" "GET" "$USER_TOKEN"
else
    echo -e "\n${RED}Test 5: Skipped - no user token${NC}"
fi

# Test 6: User signed URL (requires user token)
if [ ! -z "$USER_TOKEN" ]; then
    echo -e "\n${BLUE}Test 6: Get my signed URL (user)${NC}"
    make_request "${BASE_URL}${API_PREFIX}/my-signed-url" "GET" "$USER_TOKEN"
else
    echo -e "\n${RED}Test 6: Skipped - no user token${NC}"
fi

# Test 7: Admin user image (simplified endpoint - requires admin token)
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo -e "\n${BLUE}Test 7: Admin user image (simplified)${NC}"
    make_request "${BASE_URL}${API_PREFIX}/admin/user-image/${TARGET_USER_ID}" "GET" "$ADMIN_TOKEN"
else
    echo -e "\n${RED}Test 7: Skipped - no admin token${NC}"
fi

# Test 8: Admin signed URLs (the problematic endpoint - requires admin token)
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo -e "\n${BLUE}Test 8: Admin signed URLs${NC}"
    make_request "${BASE_URL}${API_PREFIX}/s3/admin/signed-urls/${TARGET_USER_ID}" "GET" "$ADMIN_TOKEN"
    
    # Also try with verbose output to debug the issue
    echo -e "\n${BLUE}Test 8b: Admin signed URLs (verbose)${NC}"
    echo -e "${YELLOW}Making verbose request to: ${BASE_URL}${API_PREFIX}/s3/admin/signed-urls/${TARGET_USER_ID}${NC}"
    echo -e "${BLUE}--- BEGIN VERBOSE OUTPUT ---${NC}"
    curl -v -H "Authorization: Bearer $ADMIN_TOKEN" "${BASE_URL}${API_PREFIX}/s3/admin/signed-urls/${TARGET_USER_ID}" 2>&1
    echo -e "\n${BLUE}--- END VERBOSE OUTPUT ---${NC}"
else
    echo -e "\n${RED}Test 8: Skipped - no admin token${NC}"
fi

# Test 9: List all uploads (admin endpoint)
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo -e "\n${BLUE}Test 9: List all uploads (admin)${NC}"
    make_request "${BASE_URL}${API_PREFIX}/admin/uploads" "GET" "$ADMIN_TOKEN"
else
    echo -e "\n${RED}Test 9: Skipped - no admin token${NC}"
fi

# Test 10: Try accessing the route with a slightly modified path
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo -e "\n${BLUE}Test 10: Try alternative URL paths${NC}"
    make_request "${BASE_URL}/api/s3/admin/signed-urls/${TARGET_USER_ID}" "GET" "$ADMIN_TOKEN"
    make_request "${BASE_URL}/s3/admin/signed-urls/${TARGET_USER_ID}" "GET" "$ADMIN_TOKEN"
    make_request "${BASE_URL}${API_PREFIX}/admin/signed-urls/${TARGET_USER_ID}" "GET" "$ADMIN_TOKEN"
else
    echo -e "\n${RED}Test 10: Skipped - no admin token${NC}"
fi

echo -e "\n${GREEN}========== Tests Complete ==========${NC}"
