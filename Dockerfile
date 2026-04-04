# Use official Node.js image
FROM node:20-alpine

# Use /app as the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (only production if needed, but we'll install all for local dev)
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the application port
EXPOSE 5001

# Default command to run the application (in development with nodemon)
# docker-compose will override this if needed
CMD ["npm", "run", "dev"]
