const express = require('express');
const router = express.Router();
const User = require('./auth.model');
const UserModel = require('../users/user.model'); // Import the DynamoDB User model
const bcryptjs = require('bcryptjs');
const { protect } = require('./auth.middleware');
const jwt = require('jsonwebtoken');

/**
 * User Interface Definition
 * 
 * interface User {
 *   userId: string;          // Using userId instead of _id
 *   fullName?: string;       // Optional as it might not be present in the response
 *   email: string;
 *   password?: string;
 *   phone?: string;          // Optional as it might not be present in the response
 *   role: 'user' | 'employee' | 'admin';
 *   permissions?: string[];
 *   avatar?: string;
 *   faceId?: boolean;        // Boolean indicating presence in FaceImage table or user record
 *   verificationStatus: 'pending' | 'verified' | 'rejected';
 *   aadhaarPhoto?: string;
 *   uploadedPhoto?: string | null;
 *   lastLogin?: string | Date;
 *   status: 'active' | 'suspended';
 *   createdAt?: string | Date;
 *   updatedAt?: string | Date;
 *   passwordResetToken?: string | null;
 *   passwordResetExpires?: string | null;
 * }
 */

router.get('/', protect, async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        // Check for faceId in FaceImage table
        let hasFaceId = user.faceId ? true : false;
        try {
            const faceId = await UserModel.getFaceIdFromFaceImageTable(user._id);
            if (faceId) {
                hasFaceId = true;
                // Add the faceId to the user object
                user.faceId = true;
            }
        } catch (error) {
            console.error(`Error checking FaceImage table for user ${user._id}:`, error);
        }
        
        // Format user object to match the interface
        const formattedUser = {
            userId: user._id.toString(),
            fullName: user.username || user.name || '',
            email: user.email,
            role: user.role || "user",
            permissions: user.permissions || [],
            avatar: user.avatar || null,
            faceId: hasFaceId, // Boolean - Uses both user.faceId and FaceImage table check
            verificationStatus: user.verificationStatus || "pending",
            aadhaarPhoto: user.aadhaarPhoto || null,
            uploadedPhoto: user.avatar || user.uploadedPhoto || null,
            lastLogin: user.lastLogin || null,
            status: user.status || "active",
            createdAt: user.createdAt || new Date().toISOString(),
            updatedAt: user.updatedAt || new Date().toISOString(),
            passwordResetToken: user.passwordResetToken || null,
            passwordResetExpires: user.passwordResetExpires || null,
            // Keep original fields for backward compatibility
            _id: user._id,
            name: user.username || user.name || '',
        };
        
        res.status(200).json({
            success: true,
            user: formattedUser
        });
    } catch(error) {
        console.log(error.message);
        res.status(500).json({
            success: false,
            msg: 'Server Error'
        });
    }
});

router.post('/register', async (req, res, next) => {
    const { username, email, password } = req.body;

    try {
        let user_exist = await User.findOne({ email: email });

        if(user_exist) {
            return res.status(400).json({
                success: false,
                msg: 'User already exists'
            });
        }
        
        let user = new User();

        user.username = username;
        user.email = email;

        const salt = await bcryptjs.genSalt(10);
        user.password = await bcryptjs.hash(password, salt);

        let size = 200;
        user.avatar = "https://gravatar.com/avatar/?s="+size+'&d=retro';

        await user.save();

        const payload = {
            user: {
                id: user.id
            }
        }

        jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '90d'
        }, async (err, token) => {
            if(err) throw err;
            
            // Check if the user has a record in the FaceImage table
            try {
                const faceId = await UserModel.getFaceIdFromFaceImageTable(user.id);
                if (faceId) {
                    // If found, update the user with the faceId
                    user.faceId = true;
                    await user.save();
                }
            } catch (error) {
                console.error(`Error checking FaceImage table for new user ${user.id}:`, error);
            }
            
            res.status(200).json({
                success: true,
                token: token
            });
        });

    } catch(err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: 'Something error occurred'
        });
    }
});

router.post('/login', async(req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;

    try {
        let user = await User.findOne({
            email: email
        });

        if(!user) {
            return res.status(400).json({
                success: false,
                msg: 'User not exists go & register to continue.'
            });
        }

        const isMatch = await bcryptjs.compare(password, user.password);

        if(!isMatch) {
            return res.status(400).json({
                success: false,
                msg: 'Invalid password'
            });
        }

        const payload = {
            user: {
                id: user.id
            }
        }

        jwt.sign(
            payload, process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '90d'
            }, async (err, token) => {
                if(err) throw err;

                // Format the last login date
                const lastLoginFormatted = user.lastLogin ? 
                    (new Date(user.lastLogin).toDateString() === new Date().toDateString() ? 
                        'Today' : new Date(user.lastLogin).toLocaleDateString()) : null;

                // Check if the user has a record in the FaceImage table
                let hasFaceId = user.faceId ? true : false;
                try {
                    // Try to get faceId from FaceImage table
                    const faceId = await UserModel.getFaceIdFromFaceImageTable(user._id);
                    if (faceId) {
                        hasFaceId = true;
                    }
                } catch (error) {
                    console.error(`Error checking FaceImage table for user ${user._id}:`, error);
                    // Continue with existing faceId value if error
                }

                res.status(200).json({
                    status: "success",
                    token: token,
                    data: {
                        user: {
                            userId: user._id.toString(),
                            fullName: user.username || user.name || '', // Include fullName from username or name
                            email: user.email,
                            role: user.role || "user",
                            permissions: user.permissions || [],
                            avatar: user.avatar || null,
                            faceId: hasFaceId, // Boolean - Uses both user.faceId and FaceImage table check
                            verificationStatus: user.verificationStatus || "pending",
                            aadhaarPhoto: user.aadhaarPhoto || null,
                            uploadedPhoto: user.avatar || user.uploadedPhoto || null,
                            lastLogin: user.lastLogin || null,
                            status: user.status || "active",
                            createdAt: user.createdAt || new Date().toISOString(),
                            updatedAt: user.updatedAt || new Date().toISOString(),
                            passwordResetToken: user.passwordResetToken || null,
                            passwordResetExpires: user.passwordResetExpires || null,
                            // Additional fields for backward compatibility
                            _id: user._id,
                            name: user.username || user.name || '',
                            __v: user.__v || 0,
                            lastLoginFormatted: lastLoginFormatted
                        }
                    }
                });
            }
        );

    } catch(error) {
        console.log(error.message);
        res.status(500).json({
            success: false,
            msg: 'Server Error'
        });
    }
});

module.exports = router;