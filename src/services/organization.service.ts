import User from '../data/models/user.model.js';

import Organization from '../data/models/organization.model.js';
import { CreateOrgModel } from '../models/createOrg.model.js';
import { injectable } from 'inversify';
import { ResponseModel } from '../response_models/response_model.js';
import { CreatedResponseModel } from '../response_models/created_response_model.js';
import { Role } from '../models/roles.js';
import { v4 as uuidv4 } from 'uuid';
import Invitation from '../data/models/orgInvitation.model.js';


@injectable()
export class OrganizationService {
    /**
     * Register a new user using the invitation token
     * @param creatorAddress - User's registration data
     * @param userData - Organization's basic data
     * @returns the registered user
     */
    public async createOrganization(
        creatorAddress: string,
        orgModel: CreateOrgModel
    ): Promise<ResponseModel<CreatedResponseModel | null>> {

        // Check if the user already exists (username uniqueness)
        const creator = await User.findOne({ address: creatorAddress.toLowerCase() });
        if (!creator) {
            return ResponseModel.createError(new Error('Creator not registered!'), 401);
        }

        const existingOrg = await Organization.findOne({ name: orgModel.name });

        if (existingOrg) {
            return ResponseModel.createError(new Error('Organization with this name already exists!'), 400);
        }

        const organization = new Organization({
            name: orgModel.name
        });
        await organization.save();

        creator!.organization = {
            orgId: organization._id,
            roles: [Role.Admin, Role.Contributor],
            agreement: undefined
        };

        creator!.save();

        return ResponseModel.createSuccess({ id: organization._id });
    }



    /**
     * Generate a unique invitation link for the organization
     * @param userWalletAddress - Wallet address of the user
     * @param organizationId - ID of the organization
     * @returns a unique invitation link
     */
    public async generateInvitationLink(
        userWalletAddress: string
    ): Promise<ResponseModel<any | null>> {

        const adminUser = await User.findOne({ address: userWalletAddress.toLowerCase() });
        if (!adminUser || !adminUser.organization || !(adminUser.organization.roles.indexOf(Role.Admin) !== -1)) {
            return ResponseModel.createError(new Error('Only organization admins can generate invitation links.'), 401);
        }

        // Ensure the organization exists
        const organization = await Organization.findById(adminUser.organization.orgId);
        if (!organization) {
            return ResponseModel.createError(new Error('Organization not found.'), 404);
        }

        // Generate a unique token for the invitation
        const token = uuidv4();

        // Store the invitation with a default usage limit of 10
        const invitation = new Invitation({
            token,
            organization: organization._id,
            invitedBy: adminUser._id,
            usageLimit: 10 // Set a default usage limit (can be configurable)
        });
        await invitation.save();

        return ResponseModel.createSuccess({ invitationToken: token });
    }

}
