import User from '../entities/users/user.model.js';

import { CreateOrgModel } from '../models/org/createOrg.model.js';
import { injectable } from 'inversify';
import { ResponseModel } from '../models/response_models/response_model.js';
import { CreatedResponseModel } from '../models/response_models/created_response_model.js';
import { Role } from '../entities/users/role.enum.js';
import { v4 as uuidv4 } from 'uuid';
import Invitation from '../entities/org/orgInvitation.model.js';
import Organization from '../entities/org/organization.model.js';
import { OrgDetailsModel, OrgModel } from '../models/org/editOrg.model.js';
import { CreateAgreementModel } from '../models/org/createAgreement.model.js';
import Agreement from '../entities/org/agreement.model.js';


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
        const creator = await User.findOne({ address: creatorAddress.toLowerCase() }).populate('contribution.organization');

        if (!creator) {
            return ResponseModel.createError(new Error('Creator not registered!'), 401);
        }

        const existingOrg = await Organization.findOne({ name: orgModel.name });

        if (existingOrg) {
            return ResponseModel.createError(new Error('Organization with this name already exists!'), 400);
        }

        const organization = new Organization({
            name: orgModel.name,
            logo: orgModel.logo
        });
        await organization.save();

        creator!.contribution = {
            organization: organization._id,
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
        if (!adminUser || !adminUser.contribution || !(adminUser.contribution.roles.indexOf(Role.Admin) !== -1)) {
            return ResponseModel.createError(new Error('Only organization admins can generate invitation links.'), 401);
        }

        // Ensure the organization exists
        const organization = await Organization.findById(adminUser.contribution.organization);
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
        if (!admin || !admin.contribution || !(admin.contribution.roles.indexOf(Role.Admin) !== -1)) {
            return ResponseModel.createError
                (new Error('Only organization admins can update organization details.'), 401);
        }

        const org = await Organization.findById(admin.contribution.organization);

        if (!org) {
            return ResponseModel.createError(new Error('Organization not found!'), 404);
        }

        org.name = orgModel.name;
        org.logo = orgModel.logo;
        org.par = orgModel.par;
        org.cycle = orgModel.cycle;
        org.nextRoundDate = orgModel.nextRoundDate;

        org.save();

        return ResponseModel.createSuccess({ id: org._id });
    }

    public async getOrgById(orgId: string): Promise<ResponseModel<OrgDetailsModel | null>> {
        const org = await Organization
            .findById(orgId);

        if (!org) {
            return ResponseModel.createError(new Error('Organization not found!'), 404);
        }

        const users = await User.find({
            'organization.orgId': org._id
        })
            .populate({
                path: 'contribution.agreement',
                model: 'Agreement'
            })
            .exec();

        const orgModel: OrgDetailsModel = {
            id: org._id,
            name: org.name,
            logo: org.logo,
            par: org.par,
            cycle: org.cycle,
            nextRoundDate: org.nextRoundDate,
            contributors: users.
                map(u => {
                    return {
                        id: u._id,
                        walletAddress: u.address,
                        username: u.username,
                        profilePicture: u.profilePicture,
                        agreement: {
                            marketRate: (u.contribution?.agreement as any)?.marketRate,
                            roleName: (u.contribution?.agreement as any)?.roleName,
                            responsibilities: (u.contribution?.agreement as any)?.responsibilities,
                            fiatRequested: (u.contribution?.agreement as any)?.fiatRequested,
                            commitment: (u.contribution?.agreement as any)?.commitment
                        }
                    };
                })

        };

        return ResponseModel.createSuccess(orgModel);
    }

    public async addAgreement(walletAddress: string, agreement: CreateAgreementModel)
        : Promise<ResponseModel<CreatedResponseModel | null>> {

        const admin = await User.findOne({ address: walletAddress.toLowerCase() })
            .populate({
                path: 'contribution.organization',
                model: 'Organization'
            })
            .populate({
                path: 'contribution.agreement',
                model: 'Agreement'
            });

        if (!admin || !admin.contribution || !(admin.contribution.roles.indexOf(Role.Admin) !== -1)) {
            return ResponseModel.createError
                (new Error('Only organization admins can update organization details.'), 401);
        }

        const agreementUser = await User.findById(agreement.userId)
            .populate({
                path: 'contribution.organization',
                model: 'Organization'
            })
            .populate({
                path: 'contribution.agreement',
                model: 'Agreement'
            });

        if (!agreementUser ||
            !agreementUser.contribution ||
            (agreementUser!.contribution.organization as any)._id.toString() !==
            (admin.contribution.organization as any)._id.toString()) {
            return ResponseModel.createError(new Error('User not found or not part of the organization!'), 404);
        }

        if (agreementUser.contribution.agreement) {
            return ResponseModel.createError(new Error('User already has an agreement!'), 400);
        }

        const newAgreement = new Agreement({
            user: agreement.userId,
            organization: agreementUser.contribution.organization,
            roleName: agreement.roleName,
            responsibilities: agreement.responsibilities,
            marketRate: agreement.marketRate,
            fiatRequested: agreement.fiatRequested,
            commitment: agreement.commitment
        });

        await newAgreement.save();

        agreementUser.contribution.agreement = newAgreement._id;
        agreementUser.markModified('contribution');

        await agreementUser.save();

        return ResponseModel.createSuccess({ id: newAgreement._id });
    }


    public async getUserAgreement(userId: string)
        : Promise<ResponseModel<any | null>> {

        const agreement = await Agreement.findOne({ user: userId });

        return ResponseModel.createSuccess(agreement);
    }

}
