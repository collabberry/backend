import { Router } from 'express';
import { injectable } from 'inversify';
import { OrganizationController } from '../controllers/organization.controller.js';
import { jwtMiddleware } from '../middleware/jwt.middleware.js';
import { adminMiddleware } from '../middleware/admin.middleware.js';
import multer from 'multer';

@injectable()
export class OrgRouter {
  private readonly _router: Router;

  constructor(private orgController: OrganizationController) {
    this._router = Router({ strict: true });
    this.init();
  }

  private init(): void {
    const upload = multer();

    // Regular authenticated routes
    this._router.get('/invitation', jwtMiddleware, this.orgController.getInvitationToken);
    this._router.get('/:orgId', jwtMiddleware, this.orgController.getOrg);
    this._router.get('/contributors/:contributorId/agreements', jwtMiddleware, this.orgController.getContribAgreement);
    this._router.get('/contributors/myScores', jwtMiddleware, this.orgController.getMyScores);

    // Admin-only routes now use the smart contract check
    this._router.post('/', jwtMiddleware, upload.single('logo'), this.orgController.createOrg);
    this._router.put('/', jwtMiddleware, upload.single('logo'), adminMiddleware, this.orgController.editOrg);
    this._router.post('/agreement', jwtMiddleware, adminMiddleware, this.orgController.addAgreement);
    this._router.put('/agreement/:agreementId', jwtMiddleware, adminMiddleware, this.orgController.editAgreement);
  }

  public get router(): Router {
    return this._router;
  }
}
