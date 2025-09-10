const mongoose = require('mongoose');
const User = require('../users/user.model');

// Middleware to update user record after successful file upload
exports.updateUserAfterUpload = async (req, res, next) => {
    const { fileUrl } = req.body;
    
    if (!fileUrl) {
        return next();
    }

    try {
        const userId = req.user.userId;
        if (!userId) {
            console.log('❌ No userId found in request');
            return next();
        }

        // Find and update the user record
        const updatedUser = await User.findOneAndUpdate(
            { userId: userId },
            { 
                $set: { 
                    uploadedPhoto: fileUrl,
                    updatedAt: new Date()
                }
            },
            { new: true }
        );

        if (!updatedUser) {
            console.log(`❌ No user found with userId: ${userId}`);
            return next();
        }

        console.log(`✅ Updated user ${userId} with photo URL: ${fileUrl}`);
        
    } catch (error) {
        console.error('❌ Error updating user record:', error);
    }
    
    next();
};
