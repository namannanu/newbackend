# Dummy Data Scripts

This directory contains scripts to populate your database with test data for all features in your application.

## Available Scripts

### 1. Complete Dummy Data Upload (`uploadDummyData.js`)

**⚠️ WARNING: This script will DELETE all existing data!**

This script creates comprehensive test data for all features:
- Admin users (admin with all permissions, employee with specific permissions)
- Regular users with different verification statuses
- Organizers with various activity levels
- Events (upcoming, active, completed)
- Face images and recognition data
- User event registrations
- Tickets with different statuses
- Feedback entries
- Complete relationship mapping between all entities

#### Usage:
```bash
# See help and safety warning
npm run dummy-help

# Upload complete dummy data (DELETES existing data)
npm run upload-dummy
```

#### Test Credentials Created:
- **Admin**: `admin@thrillathon.com` / `admin123` (all permissions)
- **Admin**: `admin1@thrillathon.com` / `admin123` (all permissions)
- **Employee**: `employee1@thrillathon.com` / `employee123` (specific permissions)
- **Users**: `alice@example.com`, `bob@example.com`, etc. / `user123`

### 2. Quick Test Data (`addTestData.js`)

**✅ Safe - Does NOT delete existing data**

This script adds a complete test scenario with unique identifiers:
- One test organizer
- One test event
- Two test users (one verified, one pending)
- One test admin
- Face recognition data
- Registration and ticket
- Feedback entry

#### Usage:
```bash
# Add test data (safe, doesn't delete existing data)
npm run add-test
```

## What Data is Created

### Admin Users
- Admin with all permissions
- Regular admin with all permissions
- Employee with limited/specific permissions
- Activity logs and login tracking

### Regular Users
- Users with different verification statuses (verified, pending, rejected)
- Different user roles and permission levels
- Face recognition data linked to users
- Various activity timestamps

### Organizers
- Multiple organizers with different activity levels
- Revenue and event statistics
- Contact information and status tracking

### Events
- Upcoming events (conferences, festivals, sports)
- Completed events for testing analytics
- Various ticket prices and availability
- Different organizers and locations

### Registrations & Tickets
- User event registrations with various statuses
- Face verification tracking
- Ticket issuance and check-in data
- Different verification attempt counts

### Feedback
- Multi-category feedback (overall, technical, security, support)
- Rating systems with helpful/not helpful counts
- Feedback for both completed and upcoming events
- Various review statuses

### Face Recognition
- Face images with AWS Rekognition IDs
- Confidence scores and metadata
- Links to user accounts
- Image dimensions and file sizes

## Database Schema Coverage

The scripts populate data for all models in your application:
- ✅ Users (`user.model.js`)
- ✅ Admins (`admin.model.js`)
- ✅ Events (`event.model.js`)
- ✅ Organizers (`organizer.model.js`)
- ✅ Tickets (`ticket.model.js`)
- ✅ Feedback (`feedback.model.js`)
- ✅ User Event Registrations (`userEventRegistration.model.js`)
- ✅ Face Images (`faceImage.model.js`)

## Testing Scenarios Covered

### User Verification Flow
- Users with verified face recognition
- Users pending verification
- Users with rejected verification
- Multiple verification attempts

### Event Management
- Creating and managing events
- Ticket sales and availability
- Check-in processes
- Event completion and analytics

### Admin Operations
- User management and verification
- Event oversight and statistics
- Organizer management
- System administration

### Face Recognition Testing
- Users with face data for verification testing
- Various confidence levels
- Active/inactive face recognition status

## Security Notes

- All passwords are properly hashed using bcryptjs
- Test credentials are clearly documented
- Face recognition uses placeholder URLs (update for real testing)
- All timestamps are realistic for proper testing

## Development Tips

1. **Use `addTestData.js` for development** - it's safe and adds unique test data
2. **Use `uploadDummyData.js` for fresh starts** - when you need clean, comprehensive data
3. **Check the console output** - scripts provide detailed information about what was created
4. **Test different user roles** - the data includes various permission levels for comprehensive testing

## Customization

To modify the test data:
1. Edit the data objects in the script files
2. Add new test scenarios as needed
3. Adjust quantities and relationships
4. Update test credentials and contact information

## Troubleshooting

### Connection Issues
- Ensure MongoDB is running
- Check your `config.env` file for correct `MONGO_URI`
- Verify network connectivity

### Permission Errors
- Ensure the database user has write permissions
- Check if collections exist and are accessible

### Data Conflicts
- Use unique email addresses for users and admins
- Ensure organizer emails are unique
- Check for existing data conflicts if not using the full reset

## Next Steps

After running the scripts:
1. Start your server: `npm start`
2. Test the admin panel with provided credentials
3. Test user registration and verification flows
4. Verify face recognition integration
5. Test event creation and management
6. Review analytics and reporting features

For questions or issues, check the console output for detailed error messages and refer to the main application documentation.
