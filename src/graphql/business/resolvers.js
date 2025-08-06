import { Business } from '../../models/Business.js';
import { User } from '../../models/User.js';

export const businessResolvers = {
    Query: {
        business: async (_, { id }, context) => {
            const businessId = id || context.user.business;
            if (!businessId) {
                throw new Error('Business ID required');
            }

            return await Business.findById(businessId)
                .populate('createdBy')
                .populate('members');
        },

        businessAnalytics: async (_, { businessId }, context) => {
            const bid = businessId || context.user.business;
            if (!bid) {
                throw new Error('Business ID required');
            }

            const business = await Business.findById(bid);
            if (!business) {
                throw new Error('Business not found');
            }

            return business.analytics;
        },

        businessMembers: async (_, { businessId }, context) => {
            const bid = businessId || context.user.business;
            if (!bid) {
                throw new Error('Business ID required');
            }

            const business = await Business.findById(bid).populate('members');
            if (!business) {
                throw new Error('Business not found');
            }

            return business.members;
        },

        exportBusinessData: async (_, { businessId, format = 'json' }, context) => {
            const bid = businessId || context.user.business;
            if (!bid) {
                throw new Error('Business ID required');
            }

            const business = await Business.findById(bid);
            if (!business) {
                throw new Error('Business not found');
            }

            // This would implement actual data export logic
            return `Business data exported in ${format} format`;
        }
    },

    Mutation: {
        createBusiness: async (_, { business }, context) => {
            const newBusiness = new Business({
                ...business,
                createdBy: context.user._id
            });

            return await newBusiness.save();
        },

        updateBusiness: async (_, { id, business }, context) => {
            return await Business.findByIdAndUpdate(
                id,
                { ...business, updatedAt: new Date() },
                { new: true }
            ).populate('createdBy').populate('members');
        },

        deleteBusiness: async (_, { id }, context) => {
            const result = await Business.findByIdAndDelete(id);
            return !!result;
        },

        addBusinessMember: async (_, { businessId, userId, role }, context) => {
            const business = await Business.findById(businessId);
            if (!business) {
                throw new Error('Business not found');
            }

            // Check if user is already a member
            if (business.members.includes(userId)) {
                throw new Error('User is already a member of this business');
            }

            business.members.push(userId);
            business.updatedAt = new Date();

            return await business.save();
        },

        removeBusinessMember: async (_, { businessId, userId }, context) => {
            const business = await Business.findById(businessId);
            if (!business) {
                throw new Error('Business not found');
            }

            business.members = business.members.filter(member => member.toString() !== userId);
            business.updatedAt = new Date();

            return await business.save();
        },

        updateMemberRole: async (_, { businessId, userId, role }, context) => {
            // This would update the user's role in the business
            // Implementation depends on how roles are stored
            const business = await Business.findById(businessId);
            if (!business) {
                throw new Error('Business not found');
            }

            // Update user role logic here
            business.updatedAt = new Date();

            return await business.save();
        }
    },

    Business: {
        createdBy: async (parent) => {
            if (parent.createdBy) {
                return await User.findById(parent.createdBy).select('-password');
            }
            return null;
        },

        members: async (parent) => {
            if (parent.members && parent.members.length > 0) {
                return await User.find({ _id: { $in: parent.members } }).select('-password');
            }
            return [];
        }
    }
}; 