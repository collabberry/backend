import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { container } from './inversify.config.js';
import { App } from './app.js';
import { AppDataSource } from './data-source.js';

// Initialize configuration
dotenv.config();

let server;
try {

    // Then start the application server
    const application = container.get<App>(App);
    AppDataSource.initialize().then(() => { console.log('App Data Source Connected'); });
    server = application.app.listen(process.env.PORT, async () => {
        console.log(`Server started at http://localhost:${process.env.PORT}.`);
    });
} catch (err) {
    if (server?.listening) {
        server.close();
    }
    console.error(err);
    process.exitCode = 1;
}
