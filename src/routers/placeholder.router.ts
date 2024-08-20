import { Router } from 'express';
import { injectable } from 'inversify';
import { PlaceholderController } from '../controllers/placeholder.controller.js';

@injectable()
export class PlaceholderRouter {
  private readonly _router: Router;

  constructor(private placeholderController: PlaceholderController) {
    this._router = Router({ strict: true });
    this.init();
  }

  private init(): void {
    this._router.get('/', this.placeholderController.test);
  }

  public get router(): Router {
    return this._router;
  }
}
