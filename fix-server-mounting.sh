#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== Fix Server.js Mounting ==========${NC}"

SERVER_JS_PATH="./src/server.js"

if [ ! -f "$SERVER_JS_PATH" ]; then
    echo -e "${RED}Error: $SERVER_JS_PATH not found!${NC}"
    exit 1
fi

# Backup the original file
cp "$SERVER_JS_PATH" "${SERVER_JS_PATH}.backup"
echo -e "${GREEN}Backed up original file to ${SERVER_JS_PATH}.backup${NC}"

# Find the line that mounts the amplify routes
MOUNT_LINE=$(grep -n "app.use.*amplifyRoutes" "$SERVER_JS_PATH" | cut -d':' -f1)

if [ -z "$MOUNT_LINE" ]; then
    echo -e "${RED}Couldn't find the line that mounts amplifyRoutes in $SERVER_JS_PATH${NC}"
    echo -e "${YELLOW}Please manually update the file to change:${NC}"
    echo "app.use('/api', amplifyRoutes);"
    echo -e "${GREEN}to:${NC}"
    echo "app.use('/api/s3', amplifyRoutes);"
    exit 1
fi

echo -e "${YELLOW}Found amplifyRoutes mounting at line $MOUNT_LINE${NC}"
echo -e "${YELLOW}Current line:${NC}"
sed -n "${MOUNT_LINE}p" "$SERVER_JS_PATH"

# Ask for confirmation
echo ""
echo -e "${YELLOW}Do you want to update the mount point to '/api/s3'? (y/n)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    # Update the line
    sed -i.bak "${MOUNT_LINE}s|app.use('/api', amplifyRoutes);|app.use('/api/s3', amplifyRoutes);|" "$SERVER_JS_PATH"
    
    echo -e "${GREEN}Updated $SERVER_JS_PATH successfully!${NC}"
    echo -e "${YELLOW}New line:${NC}"
    sed -n "${MOUNT_LINE}p" "$SERVER_JS_PATH"
    echo ""
    echo -e "${YELLOW}You'll need to restart your server for changes to take effect.${NC}"
    echo "After restarting, you should be able to access your endpoint at:"
    echo -e "${GREEN}http://localhost:3001/api/s3/admin/signed-urls/:userId${NC}"
else
    echo -e "${BLUE}Operation canceled. No changes were made.${NC}"
fi

echo ""
echo -e "${BLUE}Alternative solution:${NC}"
echo "If you prefer to keep the current server.js mounting, you can instead modify the routes in amplify.js"
echo "to remove the '/s3/' prefix from your route paths."
echo "I've already created a fixed version at amplify-fixed.js that you can review."
