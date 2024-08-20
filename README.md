### Collabberry Backend Readme

Welcome to the Collabberry Backend repository! This document serves as a guide for setting up and running the backend server for Collabberry.

#### Installation

Before getting started, ensure you have Node.js and Yarn installed on your machine. You can download Node.js from [here](https://nodejs.org/) and follow the instructions for your operating system. Yarn can be installed by following the instructions on the official website: [Yarn Installation Guide](https://classic.yarnpkg.com/en/docs/install/).

Once Node.js and Yarn are installed, follow these steps:

1. Clone this repository to your local machine:

   ```bash
   git clone <repository-url>
   ```

2. Navigate into the project directory:

   ```bash
   cd backend
   ```

3. Install project dependencies using Yarn:

   ```bash
   yarn install
   ```

#### Configuration

The project uses environment variables for configuration. Create a `.env` file in the root directory of the project and configure it with the required environment variables. Here's an example of how it might look:

```plaintext
PORT=3000
```

Replace with your actual database credentials.

#### Running the Server

To run the backend server, you can use the following commands:

- **Production Mode**: 

  ```bash
  yarn start
  ```

  This command compiles TypeScript files to JavaScript using the TypeScript compiler (`tsc`) and then runs the compiled JavaScript file.

- **Development Mode**:

  ```bash
  yarn dev
  ```

  This command uses `ts-node-dev` to run the TypeScript files directly, enabling automatic restarts when files are changed. It's recommended for development purposes.

#### File Structure

The project's file structure is organized as follows:

- **src/services**: Contains service modules responsible for handling business logic.
- **src/entities**: Holds entity classes for defining database tables using TypeORM for MSSQL database.
- **src/controllers**: Contains controller modules responsible for handling incoming requests and returning responses.
- **src/routers**: Defines the API routes using Express.js.

#### Additional Information

- Make sure to install all dependencies listed in `package.json` using `yarn install` before running the project.
- Ensure that your TypeScript and Node.js versions are compatible with the dependencies listed in `package.json`.

