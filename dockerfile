# Use Node.js LTS version as the base image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on (assuming default 3000, adjust if different)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
