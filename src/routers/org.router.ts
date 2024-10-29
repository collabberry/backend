import { Router } from 'express';
import { injectable } from 'inversify';
import { OrganizationController } from '../controllers/organization.controller.js';
import { jwtMiddleware } from '../middleware/jwt.middleware.js';
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
    
    // Org Details 
    this._router.post('/', jwtMiddleware, upload.single('logo'), this.orgController.createOrg);
    this._router.put('/', jwtMiddleware, upload.single('logo'), this.orgController.editOrg);
    this._router.get('/:orgId', jwtMiddleware, this.orgController.getOrg);

    // Contributors 
    this._router.get('/invitation', jwtMiddleware, this.orgController.getInvitationToken);
    this._router.post('/agreement', jwtMiddleware, this.orgController.addAgreement);
    this._router.get('/contributors/:contributorId/agreements', jwtMiddleware, this.orgController.getContribAgreement);

    // Rounds
    this._router.put('/:orgId/rounds', jwtMiddleware, this.orgController.editRound);
    this._router.get('/:orgId/rounds/current', jwtMiddleware, this.orgController.getCurrentRound);
    this._router.get('/:orgId/rounds/:id', jwtMiddleware, this.orgController.getRoundById);

    // Assessments
    this._router.post('/rounds/assess', jwtMiddleware, this.orgController.addAssessment);

  }

  public get router(): Router {
    return this._router;
  }
}
