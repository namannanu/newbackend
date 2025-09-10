#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== Update Amplify.js Route ==========${NC}"

# Path to the file
FILE_PATH="./src/features/aws/routes/amplify.js"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo -e "${RED}Error: File $FILE_PATH not found!${NC}"
    exit 1
fi

# Create a backup
cp "$FILE_PATH" "${FILE_PATH}.bak"
echo -e "${GREEN}Created backup at ${FILE_PATH}.bak${NC}"

# Check if the route exists in the file
if ! grep -q 'router\.get("/s3/admin/signed-urls/:userId"' "$FILE_PATH"; then
    echo -e "${RED}Could not find the route pattern in the file.${NC}"
    echo -e "${YELLOW}The pattern might be different or the file has already been updated.${NC}"
    
    # Check if the updated route exists
    if grep -q 'router\.get("/admin/signed-urls/:userId"' "$FILE_PATH"; then
        echo -e "${GREEN}Found the updated route pattern - the file has already been modified.${NC}"
    fi
    
    exit 1
fi

# Update the file
sed -i '' 's|router\.get("/s3/admin/signed-urls/:userId"|router\.get("/admin/signed-urls/:userId"|g' "$FILE_PATH"

# Check if the update was successful
if grep -q 'router\.get("/admin/signed-urls/:userId"' "$FILE_PATH"; then
    echo -e "${GREEN}Successfully updated the route in ${FILE_PATH}${NC}"
else
    echo -e "${RED}Failed to update the route.${NC}"
    exit 1
fi

echo -e "${BLUE}========== Update Complete ==========${NC}"
echo -e "${YELLOW}Remember to restart your server for changes to take effect!${NC}"
echo -e "${YELLOW}After restarting, test with: ./test-routes-simple.sh${NC}"
