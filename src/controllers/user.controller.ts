import { injectable } from 'inversify';
import { Request, Response } from 'express';
import { UserService } from '../services/user.service.js';
import { CreateUserModel, createUserScheme } from '../models/user/userRegistration.model.js';
import { handleResponse } from '../models/response_models/request_handler.js';
import { verifySignatureSchema, walletAddressSchema } from '../models/user/wallet.model.js';
import { uploadFileToS3 } from '../utils/fileUploader.js';

@injectable()
export class UserController {

    constructor(private userService: UserService) { }

    /**
     * Request a nonce for wallet authentication
     */
    public requestNonce = async (req: Request, res: Response) => {
        try {
            const isValid = walletAddressSchema.validate(req.body);
            if (isValid.error) {
                return res.status(400).json({ message: isValid.error.message });
            }

            // Request nonce from the AuthService
            const responseModel = await this.userService.requestNonce(req.body.walletAddress);
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error requesting nonce:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Verify the signed nonce to authenticate the user
     */
    public verifySignature = async (req: Request, res: Response) => {
        try {
            const { message, signature } = req.body;

            const isValid = verifySignatureSchema.validate(req.body);
            if (isValid.error) {
                return res.status(400).json({ message: isValid.error.message });
            }
            // Verify the signature and authenticate the user
            const responseModel = await this.userService.verifySignature(message, signature);
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error verifying signature:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Register a new user
     */
    public registerUser = async (req: any, res: Response) => {
        try {
            const body: CreateUserModel = req.body;
            const isValid = createUserScheme.validate(body);
            if (isValid.error) {
                return res.status(400).json({ message: isValid.error.message });
            }

            body.walletAddress = req.user.walletAddress;

             // Handle file upload (assuming the file is sent in req.file or req.files)
             const file = (req as any).file;
             let avatar: string | undefined;

             if (file) {
                 const uploadResult = await uploadFileToS3({
                     Bucket: process.env.S3_BUCKET_NAME!, // Ensure your bucket name is in env variables
                     Key: `profile-pics/${file.originalname}`, // Customize the path and filename as needed
                     Body: file.buffer,
                     ContentType: file.mimetype
                 });

                 avatar = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${uploadResult}`;
             }

             body.profilePicture = avatar;
            const responseModel = await this.userService.registerUser(body);
            return res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error registering user:', error);
            res.status(500).send('Internal Server Error');
        }
    }


    /**
     * Get User Me
     */
    public getUserMe = async (req: any, res: Response) => {
        try {
            const walletAddress = req.user.walletAddress;
            const responseModel = await this.userService.getByWalletAddress(walletAddress);
            return res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error registering user:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
