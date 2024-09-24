import { Router } from 'express';
import { injectable } from 'inversify';
import { UserController } from '../controllers/user.controller.js';
import { jwtMiddleware } from '../middleware/jwt.middleware.js';

@injectable()
export class UserRouter {
  private readonly _router: Router;

  constructor(private userController: UserController) {
    this._router = Router({ strict: true });
    this.init();
  }

  private init(): void {
    this._router.post('/auth/nonce', this.userController.requestNonce);
    this._router.post('/auth/token', this.userController.verifySignature);
    this._router.post('/', jwtMiddleware,  this.userController.registerUser);
    this._router.get('/me', jwtMiddleware, this.userController.getUserMe);
  }

  public get router(): Router {
    return this._router;
  }
}
