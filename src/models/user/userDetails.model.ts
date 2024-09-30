export interface UserResponseModel {
    walletAddress?: string;
    username: string;
    email: string;
    profilePicture?: string;
    organization?: OrganizationListResponseModel | null;
}

export interface OrganizationListResponseModel {
    name: string;
    id: string;
}
