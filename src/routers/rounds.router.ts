import { Router } from 'express';
import { injectable } from 'inversify';
import { RoundsController } from '../controllers/rounds.controller.js';
import { jwtMiddleware } from '../middleware/jwt.middleware.js';
import { adminMiddleware } from '../middleware/admin.middleware.js';

@injectable()
export class RoundsRouter {
  private readonly _router: Router;

  constructor(private roundsController: RoundsController) {
    this._router = Router({ strict: true });
    this.init();
  }

  private init(): void {
    // Regular authenticated routes
    this._router.get('/current', jwtMiddleware, this.roundsController.getCurrentRound);
    this._router.get('/', jwtMiddleware, this.roundsController.getRounds);
    this._router.get('/:roundId', jwtMiddleware, this.roundsController.getRoundById);
    this._router.post('/assess', jwtMiddleware, this.roundsController.addAssessment);
    this._router.get('/:roundId/assessments', jwtMiddleware, this.roundsController.getAssessments);
    this._router.put('/:roundId/assessments/:assessmentId', jwtMiddleware, this.roundsController.editAssessment);

    // Admin-only routes now use the smart contract check
    this._router.put('/:roundId', jwtMiddleware, adminMiddleware, this.roundsController.editRound);
    this._router.post('/:roundId/assessments/remind',
      jwtMiddleware,
      adminMiddleware,
       this.roundsController.remind);
    this._router.post('/:roundId/txHash',
       jwtMiddleware,
       adminMiddleware,
       this.roundsController.addTokenMintTx);
  }

  public get router(): Router {
    return this._router;
  }
}
