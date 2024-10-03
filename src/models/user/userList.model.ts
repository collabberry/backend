import { AgreementModel } from './userDetails.model.js';

export interface UserListModel {
    id: string;
    walletAddress?: string;
    username: string;
    profilePicture?: string;
    agreement: AgreementModel;
}

