#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVER_JS_PATH="./src/server.js"
PATCH_PATH="./server-patch.js"

echo -e "${BLUE}========== Adding Test Router to Server.js ==========${NC}"

# Check if server.js exists
if [ ! -f "$SERVER_JS_PATH" ]; then
    echo -e "${RED}Error: server.js not found at $SERVER_JS_PATH${NC}"
    exit 1
fi

# Create patch code
cat > "$PATCH_PATH" << 'EOF'
// Import the test router
const adminUrlTestRouter = require('./admin-url-test');

// Mount the test router at /api/test-admin-url
app.use('/api/test-admin-url', adminUrlTestRouter);
console.log('✅ Admin URL Test router registered at /api/test-admin-url');
EOF

# Find a good location to insert the patch
MOUNT_LINE=$(grep -n "app.use('/api', amplifyRoutes);" "$SERVER_JS_PATH" | cut -d':' -f1)

if [ -z "$MOUNT_LINE" ]; then
    echo -e "${RED}Couldn't find the line to patch after.${NC}"
    exit 1
fi

# Calculate the line after the target
INSERT_LINE=$((MOUNT_LINE + 2))

# Backup the original file
cp "$SERVER_JS_PATH" "${SERVER_JS_PATH}.bak"
echo -e "${GREEN}Backed up original file to ${SERVER_JS_PATH}.bak${NC}"

# Insert the patch code
head -n $INSERT_LINE "$SERVER_JS_PATH" > "${SERVER_JS_PATH}.tmp"
cat "$PATCH_PATH" >> "${SERVER_JS_PATH}.tmp"
tail -n +$((INSERT_LINE + 1)) "$SERVER_JS_PATH" >> "${SERVER_JS_PATH}.tmp"
mv "${SERVER_JS_PATH}.tmp" "$SERVER_JS_PATH"

echo -e "${GREEN}Successfully patched server.js!${NC}"
echo -e "${YELLOW}The test router is now available at:${NC}"
echo -e "${GREEN}http://localhost:3001/api/test-admin-url/ping${NC}"
echo -e "${GREEN}http://localhost:3001/api/test-admin-url/admin-url/:userId${NC}"
echo ""
echo -e "${YELLOW}Please restart your server for the changes to take effect.${NC}"
echo -e "${YELLOW}After restarting, test the endpoint with your admin token:${NC}"
echo -e "${GREEN}curl -H \"Authorization: Bearer YOUR_ADMIN_TOKEN\" http://localhost:3001/api/test-admin-url/admin-url/kkuserid${NC}"

# Clean up
rm "$PATCH_PATH"
