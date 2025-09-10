#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== Fix for Admin Signed URLs Endpoint ==========${NC}"

# Configuration
BASE_URL="http://localhost:3001"
USERID="kkuserid"

echo -e "${YELLOW}The issue is with how the routes are mounted in your Express application.${NC}"
echo -e "${YELLOW}The amplify router is mounted at /api, but some routes include a /s3 prefix.${NC}"
echo ""
echo -e "${RED}The URL you were trying:${NC}"
echo -e "${RED}${BASE_URL}/api/s3/admin/signed-urls/${USERID}${NC}"
echo ""
echo -e "${GREEN}Correct URLs to try:${NC}"
echo -e "${GREEN}${BASE_URL}/api/admin/signed-urls/${USERID}${NC}"
echo -e "${GREEN}- OR -${NC}"
echo -e "${GREEN}${BASE_URL}/api/s3/admin/signed-urls/${USERID} (if you fix the server.js mounting)${NC}"
echo ""
echo -e "${YELLOW}Solution Options:${NC}"
echo "1. Update your server.js to mount the routes correctly:"
echo "   app.use('/api/s3', amplifyRoutes); // Instead of app.use('/api', amplifyRoutes);"
echo ""
echo "2. OR Update your routes in amplify.js to remove the '/s3/' prefix:"
echo "   router.get('/admin/signed-urls/:userId', ...) // Instead of /s3/admin/signed-urls/:userId"
echo ""
echo -e "${BLUE}To help you quickly test, I've created:${NC}"
echo "1. amplify-fixed.js - A modified version with the routes fixed"
echo "2. test-fixed-routes.sh - A script to test the fixed routes"
echo ""
echo -e "${YELLOW}To fix this permanently, choose one of the options above.${NC}"
