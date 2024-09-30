import User from '../entities/users/user.model.js';

import { CreateOrgModel } from '../models/org/createOrg.model.js';
import { injectable } from 'inversify';
import { ResponseModel } from '../models/response_models/response_model.js';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import { Role } from '../entities/users/role.enum.js';
import { v4 as uuidv4 } from 'uuid';
import Invitation from '../entities/org/orgInvitation.model.js';
import Organization from '../entities/org/organization.model.js';
import { OrgModel } from '../models/org/editOrg.model.js';


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


    public async editOrganization(
        walletAddress: string,
        orgModel: OrgModel
    ): Promise<ResponseModel<CreatedResponseModel | null>> {

        const admin = await User.findOne({ address: walletAddress.toLowerCase() });
        if (!admin || !admin.organization || !(admin.organization.roles.indexOf(Role.Admin) !== -1)) {
            return ResponseModel.createError
                (new Error('Only organization admins can update organization details.'), 401);
        }

        const org = await Organization.findOne({ name: orgModel.name });

        if (!org) {
            return ResponseModel.createError(new Error('Organization not found!'), 404);
        }

        org.name = orgModel.name;
        org.logo = orgModel.logo;
        org.par = orgModel.par;
        org.cycle = orgModel.cycle;
        org.startDate = orgModel.startDate;

        org.save();

        return ResponseModel.createSuccess({ id: org._id });
    }

    public async getOrgById(orgId: string): Promise<ResponseModel<OrgModel | null>> {
        const org = await Organization
            .findById(orgId);

        if (!org) {
            return ResponseModel.createError(new Error('Organization not found!'), 404);
        }
        const orgModel: OrgModel = {
            id: org._id,
            name: org.name,
            logo: org.logo,
            par: org.par,
            cycle: org.cycle,
            startDate: org.startDate
        };

        return ResponseModel.createSuccess(orgModel);
    }


}
