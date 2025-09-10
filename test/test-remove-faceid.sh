#!/bin/bash

# This script tests the admin API endpoint for checking face data
# Usage: ./test-face-data.sh <admin_token> <user_id>

# Check if we have the required parameters
if [ $# -lt 2 ]; then
  echo "Usage: $0 <admin_token> <user_id>"
  echo "Example: $0 eyJhbGciOiJ... kannuuserid"
  exit 1
fi

ADMIN_TOKEN=$1
USER_ID=$2
API_URL="http://localhost:3000/api/admin/users/${USER_ID}/face-data"

echo "Checking face data for user: ${USER_ID}"
echo "API URL: ${API_URL}"
echo

echo "Sending request to check face data..."
curl -X GET \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  ${API_URL} \
  -v

echo
echo "Done."
