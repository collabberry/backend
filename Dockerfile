FROM node:20.12.1-slim AS build

# Install dependencies
WORKDIR /app
COPY ./package.json .
COPY ./yarn.lock .
RUN yarn install

# Build the application
COPY . .
COPY ["./tsconfig.json", "tslint.json", "./"]
RUN yarn build

# Run the application
CMD ["node", "/app/dist/src/index.js"]
