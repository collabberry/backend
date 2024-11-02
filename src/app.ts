import 'reflect-metadata';
import { config as dotnev_config } from 'dotenv';
dotnev_config();
import express from 'express';
import bodyParser from 'body-parser';
import { injectable } from 'inversify';
import { UserRouter } from './routers/user.router.js';
import { OrgRouter } from './routers/org.router.js';
import { RoundsRouter } from './routers/rounds.router.js';
import cors from 'cors';

@injectable()
export class App {

    constructor(
        private userRouter: UserRouter,
        private orgRouter: OrgRouter,
        private roundsRouter: RoundsRouter
    ) {
        this._app = express();
        this.config();
    }

    public get app(): express.Application {
        return this._app;
    }
    private _app: express.Application;

    private config(): void {
        // parse application/x-www-form-urlencoded
        this._app.use(bodyParser.urlencoded({ extended: false }));

        // parse application/json
        this._app.use(bodyParser.json());

        // support application/x-www-form-urlencoded post data
        this._app.use(bodyParser.urlencoded({ extended: false }));

        // this._app.use(cookieParser());

        let allowedOrigins = [/localhost:\d{4}$/, process.env.FRONT_URL];
        if (process.env.CORS_ORIGINS) {
            allowedOrigins = allowedOrigins.concat(process.env.CORS_ORIGINS.split(','));
        }

        this._app.use(cors());

        // Initialize app routes
        this._initRoutes();
    }
    _initRoutes(): void {
        this._app.use('/api/users', this.userRouter.router);
        this._app.use('/api/orgs', this.orgRouter.router);
        this._app.use('/api/rounds', this.roundsRouter.router);
    }
}
