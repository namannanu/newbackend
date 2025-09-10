const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const colors = require('colors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({
    path: path.join(__dirname, '../config/config.env'),
});

// Import models
const User = require('../features/users/user.model');
const Admin = require('../features/admin/admin.model');
const Event = require('../features/events/event.model');
const Organizer = require('../features/organizers/organizer.model');
const Ticket = require('../features/tickets/ticket.model');
const Feedback = require('../features/feedback/feedback.model');
const UserEventRegistration = require('../features/registrations/userEventRegistration.model');
const FaceImage = require('../features/face-recognition/faceImage.model');

// Connect to database
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`.cyan.bold);
    } catch (error) {
        console.error(`Error: ${error.message}`.red.bold);
        process.exit(1);
    }
};

// Generate dummy data
const generateDummyData = async () => {
    try {
        console.log('🗑️  Clearing existing data...'.yellow);
        
        // Clear existing data
        await Promise.all([
            User.deleteMany({}),
            Admin.deleteMany({}),
            Event.deleteMany({}),
            Organizer.deleteMany({}),
            Ticket.deleteMany({}),
            Feedback.deleteMany({}),
            UserEventRegistration.deleteMany({}),
            FaceImage.deleteMany({})
        ]);

        console.log('✅ Existing data cleared'.green);

        // 1. Create Admin Users
        console.log('👤 Creating admin users...'.blue);
        const admins = await Admin.create([
            {
                email: 'admin@thrillathon.com',
                password: 'admin123',
                role: 'admin',
                permissions: ['all'],
                status: 'active',
                lastLogin: new Date(),
                lastActivity: new Date()
            },
            {
                email: 'admin1@thrillathon.com',
                password: 'admin123',
                role: 'admin',
                permissions: ['all'],
                status: 'active',
                lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
                lastActivity: new Date()
            },
            {
                email: 'employee1@thrillathon.com',
                password: 'employee123',
                role: 'employee',
                permissions: ['user_management', 'event_management'],
                status: 'active',
                lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                lastActivity: new Date()
            }
        ]);
        console.log(`✅ Created ${admins.length} admin users`.green);

        // 2. Create Organizers
        console.log('🏢 Creating organizers...'.blue);
        const organizers = await Organizer.create([
            {
                name: 'TechEvents Pro',
                email: 'contact@techevents.com',
                phone: '+1234567890',
                address: '123 Tech Street, Silicon Valley, CA',
                website: 'https://techevents.com',
                description: 'Professional technology event organizer specializing in conferences and workshops',
                contactPerson: 'John Smith',
                status: 'active',
                joinDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
                lastActivity: new Date(),
                totalRevenue: 125000,
                totalEvents: 15,
                activeEvents: 3
            },
            {
                name: 'Entertainment Hub',
                email: 'info@entertainmenthub.com',
                phone: '+1234567891',
                address: '456 Entertainment Blvd, Los Angeles, CA',
                website: 'https://entertainmenthub.com',
                description: 'Entertainment and music event organizer for concerts and festivals',
                contactPerson: 'Sarah Johnson',
                status: 'active',
                joinDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
                lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000),
                totalRevenue: 250000,
                totalEvents: 25,
                activeEvents: 5
            },
            {
                name: 'Sports Central',
                email: 'events@sportscentral.com',
                phone: '+1234567892',
                address: '789 Sports Ave, Chicago, IL',
                website: 'https://sportscentral.com',
                description: 'Sports event organizer for tournaments and competitions',
                contactPerson: 'Mike Wilson',
                status: 'active',
                joinDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 3 months ago
                lastActivity: new Date(Date.now() - 48 * 60 * 60 * 1000),
                totalRevenue: 80000,
                totalEvents: 8,
                activeEvents: 2
            }
        ]);
        console.log(`✅ Created ${organizers.length} organizers`.green);

        // 3. Create Events
        console.log('🎉 Creating events...'.blue);
        const events = await Event.create([
            {
                name: 'AI & Machine Learning Conference 2025',
                description: 'A comprehensive conference covering the latest in AI and ML technologies',
                date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                startTime: '09:00',
                endTime: '17:00',
                location: 'Convention Center, San Francisco, CA',
                organizer: organizers[0]._id,
                totalTickets: 500,
                ticketsSold: 320,
                ticketPrice: 250,
                status: 'upcoming',
                coverImage: '/placeholder-images/events/ai-conference.jpg'
            },
            {
                name: 'Summer Music Festival',
                description: 'Three-day outdoor music festival featuring top artists',
                date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
                startTime: '14:00',
                endTime: '23:00',
                location: 'Central Park, New York, NY',
                organizer: organizers[1]._id,
                totalTickets: 2000,
                ticketsSold: 1850,
                ticketPrice: 150,
                status: 'upcoming',
                coverImage: '/placeholder-images/events/music-festival.jpg'
            },
            {
                name: 'Basketball Championship',
                description: 'Regional basketball championship tournament',
                date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
                startTime: '18:00',
                endTime: '22:00',
                location: 'Sports Arena, Chicago, IL',
                organizer: organizers[2]._id,
                totalTickets: 800,
                ticketsSold: 650,
                ticketPrice: 75,
                status: 'upcoming',
                coverImage: '/placeholder-images/events/basketball.jpg'
            },
            {
                name: 'Web Development Workshop',
                description: 'Hands-on workshop for modern web development techniques',
                date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago (completed)
                startTime: '10:00',
                endTime: '16:00',
                location: 'Tech Hub, Austin, TX',
                organizer: organizers[0]._id,
                totalTickets: 100,
                ticketsSold: 95,
                ticketPrice: 99,
                status: 'completed',
                coverImage: '/placeholder-images/events/web-workshop.jpg'
            },
            {
                name: 'Jazz Night',
                description: 'An evening of smooth jazz and fine dining',
                date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago (completed)
                startTime: '19:00',
                endTime: '23:00',
                location: 'Blue Note Club, New Orleans, LA',
                organizer: organizers[1]._id,
                totalTickets: 200,
                ticketsSold: 180,
                ticketPrice: 85,
                status: 'completed',
                coverImage: '/placeholder-images/events/jazz-night.jpg'
            }
        ]);
        console.log(`✅ Created ${events.length} events`.green);

        // 4. Create Users
        console.log('👥 Creating users...'.blue);
        const hashedPassword = await bcrypt.hash('user123', 12);
        const users = await User.create([
            {
                fullName: 'Alice Johnson',
                email: 'alice@example.com',
                password: hashedPassword,
                phone: '+1234567801',
                role: 'user',
                verificationStatus: 'verified',
                status: 'active',
                lastLogin: new Date(),
                uploadedPhoto: '/placeholder-images/alice.jpg'
            },
            {
                fullName: 'Bob Smith',
                email: 'bob@example.com',
                password: hashedPassword,
                phone: '+1234567802',
                role: 'user',
                verificationStatus: 'verified',
                status: 'active',
                lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
                uploadedPhoto: '/placeholder-images/bob.jpg'
            },
            {
                fullName: 'Carol Davis',
                email: 'carol@example.com',
                password: hashedPassword,
                phone: '+1234567803',
                role: 'user',
                verificationStatus: 'verified',
                status: 'active',
                lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000),
                uploadedPhoto: '/placeholder-images/carol.jpg'
            },
            {
                fullName: 'David Wilson',
                email: 'david@example.com',
                password: hashedPassword,
                phone: '+1234567804',
                role: 'user',
                verificationStatus: 'pending',
                status: 'active',
                lastLogin: new Date(Date.now() - 48 * 60 * 60 * 1000),
                uploadedPhoto: '/placeholder-images/david.jpg'
            },
            {
                fullName: 'Emma Brown',
                email: 'emma@example.com',
                password: hashedPassword,
                phone: '+1234567805',
                role: 'user',
                verificationStatus: 'verified',
                status: 'active',
                lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                uploadedPhoto: '/placeholder-images/emma.jpg'
            },
            {
                fullName: 'Frank Garcia',
                email: 'frank@example.com',
                password: hashedPassword,
                phone: '+1234567806',
                role: 'user',
                verificationStatus: 'rejected',
                status: 'suspended',
                lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                uploadedPhoto: '/placeholder-images/frank.jpg'
            }
        ]);
        console.log(`✅ Created ${users.length} users`.green);

        // 5. Create Face Images
        console.log('📷 Creating face images...'.blue);
        const faceImages = await FaceImage.create([
            {
                rekognitionId: 'face_001_alice',
                fullName: 'Alice Johnson',
                imageUrl: '/placeholder-images/faces/alice_face.jpg',
                confidence: 95.5,
                userId: users[0]._id,
                isActive: true,
                metadata: {
                    fileSize: 1024000,
                    dimensions: { width: 512, height: 512 }
                }
            },
            {
                rekognitionId: 'face_002_bob',
                fullName: 'Bob Smith',
                imageUrl: '/placeholder-images/faces/bob_face.jpg',
                confidence: 92.3,
                userId: users[1]._id,
                isActive: true,
                metadata: {
                    fileSize: 896000,
                    dimensions: { width: 512, height: 512 }
                }
            },
            {
                rekognitionId: 'face_003_carol',
                fullName: 'Carol Davis',
                imageUrl: '/placeholder-images/faces/carol_face.jpg',
                confidence: 97.8,
                userId: users[2]._id,
                isActive: true,
                metadata: {
                    fileSize: 1152000,
                    dimensions: { width: 512, height: 512 }
                }
            }
        ]);
        console.log(`✅ Created ${faceImages.length} face images`.green);

        // Update users with faceId references
        await User.findByIdAndUpdate(users[0]._id, { faceId: faceImages[0]._id });
        await User.findByIdAndUpdate(users[1]._id, { faceId: faceImages[1]._id });
        await User.findByIdAndUpdate(users[2]._id, { faceId: faceImages[2]._id });

        // 6. Create User Event Registrations
        console.log('📝 Creating user event registrations...'.blue);
        const registrations = await UserEventRegistration.create([
            {
                eventId: events[0]._id, // AI Conference
                userId: users[0]._id, // Alice
                status: 'verified',
                faceVerificationStatus: 'success',
                ticketAvailabilityStatus: 'available',
                ticketIssued: true,
                ticketIssuedDate: new Date(),
                verificationAttempts: 1,
                lastVerificationAttempt: new Date()
            },
            {
                eventId: events[0]._id, // AI Conference
                userId: users[1]._id, // Bob
                status: 'verified',
                faceVerificationStatus: 'success',
                ticketAvailabilityStatus: 'available',
                ticketIssued: true,
                ticketIssuedDate: new Date(),
                verificationAttempts: 1,
                lastVerificationAttempt: new Date()
            },
            {
                eventId: events[1]._id, // Music Festival
                userId: users[2]._id, // Carol
                status: 'verified',
                faceVerificationStatus: 'success',
                ticketAvailabilityStatus: 'available',
                ticketIssued: true,
                ticketIssuedDate: new Date(),
                verificationAttempts: 1,
                lastVerificationAttempt: new Date()
            },
            {
                eventId: events[2]._id, // Basketball
                userId: users[3]._id, // David
                status: 'pending',
                faceVerificationStatus: 'pending',
                ticketAvailabilityStatus: 'pending',
                ticketIssued: false,
                verificationAttempts: 0
            },
            {
                eventId: events[3]._id, // Web Workshop (completed)
                userId: users[0]._id, // Alice
                status: 'verified',
                faceVerificationStatus: 'success',
                ticketAvailabilityStatus: 'available',
                ticketIssued: true,
                ticketIssuedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                checkInTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                verificationAttempts: 1,
                lastVerificationAttempt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
            }
        ]);
        console.log(`✅ Created ${registrations.length} user event registrations`.green);

        // 7. Create Tickets
        console.log('🎫 Creating tickets...'.blue);
        const tickets = await Ticket.create([
            {
                event: events[0]._id,
                user: users[0]._id,
                ticketId: 'TKT-AI2025-001',
                seatNumber: 'A-15',
                price: 250,
                status: 'active',
                faceVerified: true
            },
            {
                event: events[0]._id,
                user: users[1]._id,
                ticketId: 'TKT-AI2025-002',
                seatNumber: 'A-16',
                price: 250,
                status: 'active',
                faceVerified: true
            },
            {
                event: events[1]._id,
                user: users[2]._id,
                ticketId: 'TKT-MUS2025-001',
                seatNumber: 'GA-001',
                price: 150,
                status: 'active',
                faceVerified: true
            },
            {
                event: events[3]._id, // Completed event
                user: users[0]._id,
                ticketId: 'TKT-WEB2025-001',
                seatNumber: 'WS-10',
                price: 99,
                status: 'checked-in',
                checkInTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                faceVerified: true
            },
            {
                event: events[4]._id, // Jazz Night (completed)
                user: users[4]._id,
                ticketId: 'TKT-JAZ2025-001',
                seatNumber: 'VIP-05',
                price: 85,
                status: 'checked-in',
                checkInTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                faceVerified: false
            }
        ]);
        console.log(`✅ Created ${tickets.length} tickets`.green);

        // 8. Create Feedback
        console.log('💬 Creating feedback...'.blue);
        const feedbacks = await Feedback.create([
            {
                user: users[0]._id,
                event: events[3]._id, // Web Workshop (completed)
                feedbackEntries: [
                    {
                        rating: 5,
                        category: 'overall',
                        subject: 'Excellent Workshop',
                        message: 'Great content and well-organized. Learned a lot about modern web development.',
                        status: 'reviewed',
                        helpful: 8,
                        notHelpful: 1
                    },
                    {
                        rating: 4,
                        category: 'technical',
                        subject: 'Technical Setup',
                        message: 'Some minor issues with the development environment setup.',
                        status: 'reviewed',
                        helpful: 3,
                        notHelpful: 0
                    }
                ]
            },
            {
                user: users[4]._id,
                event: events[4]._id, // Jazz Night (completed)
                feedbackEntries: [
                    {
                        rating: 4,
                        category: 'overall',
                        subject: 'Great Atmosphere',
                        message: 'Wonderful evening with amazing music and ambiance.',
                        status: 'reviewed',
                        helpful: 12,
                        notHelpful: 0
                    },
                    {
                        rating: 3,
                        category: 'security',
                        subject: 'Check-in Process',
                        message: 'Face verification had some issues, took longer than expected.',
                        status: 'new',
                        helpful: 5,
                        notHelpful: 2
                    }
                ]
            },
            {
                user: users[1]._id,
                event: events[0]._id, // AI Conference (upcoming)
                feedbackEntries: [
                    {
                        rating: 5,
                        category: 'support',
                        subject: 'Excellent Customer Service',
                        message: 'The support team was very helpful with my registration questions.',
                        status: 'new',
                        helpful: 6,
                        notHelpful: 0
                    }
                ]
            }
        ]);
        console.log(`✅ Created ${feedbacks.length} feedback entries`.green);

        console.log('\n🎉 Dummy data generation completed successfully!'.green.bold);
        console.log('\n📊 Summary:'.cyan.bold);
        console.log(`   👤 Admin Users: ${admins.length}`);
        console.log(`   👥 Regular Users: ${users.length}`);
        console.log(`   🏢 Organizers: ${organizers.length}`);
        console.log(`   🎉 Events: ${events.length}`);
        console.log(`   📷 Face Images: ${faceImages.length}`);
        console.log(`   📝 Registrations: ${registrations.length}`);
        console.log(`   🎫 Tickets: ${tickets.length}`);
        console.log(`   💬 Feedback: ${feedbacks.length}`);

        console.log('\n🔐 Test Credentials:'.yellow.bold);
        console.log('   Admin (all permissions): admin@thrillathon.com / admin123');
        console.log('   Admin (all permissions): admin1@thrillathon.com / admin123');
        console.log('   Employee (specific permissions): employee1@thrillathon.com / employee123');
        console.log('   User: alice@example.com / user123');
        console.log('   User: bob@example.com / user123');
        console.log('   (All users have password: user123)');

    } catch (error) {
        console.error('❌ Error generating dummy data:'.red.bold, error);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        await connectDB();
        await generateDummyData();
        console.log('\n✅ All done! Exiting...'.green.bold);
        process.exit(0);
    } catch (error) {
        console.error('❌ Script failed:'.red.bold, error);
        process.exit(1);
    }
};

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log('\n📋 Dummy Data Upload Script'.cyan.bold);
    console.log('\nThis script will:');
    console.log('  • Clear all existing data');
    console.log('  • Generate comprehensive test data for all features');
    console.log('  • Create users, admins, events, tickets, feedback, etc.');
    console.log('\n🚀 Usage:');
    console.log('  node uploadDummyData.js');
    console.log('  node uploadDummyData.js --confirm');
    console.log('\n⚠️  WARNING: This will DELETE all existing data!');
    process.exit(0);
}

if (!args.includes('--confirm')) {
    console.log('\n⚠️  WARNING: This script will DELETE all existing data and create new dummy data!'.red.bold);
    console.log('If you are sure you want to proceed, run:');
    console.log('node uploadDummyData.js --confirm'.yellow);
    process.exit(0);
}

// Run the script
main();
