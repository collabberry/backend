import { Router } from 'express';
import { injectable } from 'inversify';
import { OrganizationController } from '../controllers/organization.controller.js';
import { jwtMiddleware } from '../middleware/jwt.middleware.js';

@injectable()
export class OrgRouter {
  private readonly _router: Router;

  constructor(private orgController: OrganizationController) {
    this._router = Router({ strict: true });
    this.init();
  }

  private init(): void {
    this._router.post('/', jwtMiddleware, this.orgController.createOrg);
    this._router.put('/', jwtMiddleware, this.orgController.editOrg);
    this._router.get('/:orgId', jwtMiddleware, this.orgController.getOrg);
    this._router.get('/:orgId/invitation', jwtMiddleware, this.orgController.getInvitationToken);
  }

  public get router(): Router {
    return this._router;
  }
}
