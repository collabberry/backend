import { Role } from '../../entities/index.js';

export interface UserResponseModel {
    id: string;
    walletAddress?: string;
    username: string;
    email: string;
    profilePicture?: string;
    isAdmin: boolean;
    organization?: OrganizationListModel | null;
    agreement?: AgreementModel | null;
}

export interface AgreementModel {
    roleName: string;
    responsibilities: string;
    marketRate: number;
    fiatRequested: number;
    commitment: number;
}

export interface OrganizationListModel {
    id: string;
    name: string;
    logo?: string | null;
}


