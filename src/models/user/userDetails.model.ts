export interface UserResponseModel {
    walletAddress?: string;
    username: string;
    email: string;
    profilePicture?: string;
    contribution?: OrganizationContributorModel | null;
}

export interface AgreementModel {
    roleName: string;
    responsibilities: string;
    marketRate: number;
    fiatRequested: number;
    commitment: number;
}

export interface OrganizationContributorModel {
    id: string;
    name: string;
    roles: string[];
    agreement: AgreementModel;
}
