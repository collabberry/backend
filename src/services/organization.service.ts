import User from '../data/models/user.model.js';

import Organization from '../data/models/organization.model.js';
import { CreateUserModel } from '../models/userRegistration.model.js';
import { CreateOrgModel } from '../models/createOrg.model.js';
import { injectable } from 'inversify';
import { ResponseModel } from '../response_models/response_model.js';
import { CreatedResponseModel } from '../response_models/created_response_model.js';
import { userInfo } from 'os';
import { Role } from '../models/roles.js';


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

        console.log(creatorAddress);
        // Check if the user already exists (username uniqueness)
        const creator = await User.findOne({ address: creatorAddress.toLowerCase() });
        if (!creator) {
            return ResponseModel.createError(new Error('Creator not registered!'), 401);
        }

        const organization = new Organization({
            name: orgModel.name
        });
        await organization.save();

        creator!.organizationDetails!.push({
            organization: organization._id,
            roles: [Role.Admin, Role.Contributor],
            agreement: undefined
        });

        creator!.save();

        return ResponseModel.createSuccess({ id: organization._id });
    }
}
