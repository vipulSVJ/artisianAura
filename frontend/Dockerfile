# Stage 1: Build the React Application
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
# We use npm install here, or yarn if there is a yarn.lock
COPY package*.json yarn.lock* ./
RUN npm install

# Pass backend URL dynamically during build time
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

ARG REACT_APP_RAZORPAY_KEY_ID
ENV REACT_APP_RAZORPAY_KEY_ID=$REACT_APP_RAZORPAY_KEY_ID

# Copy the rest of the application
COPY . .

# Build the app to the /app/build folder
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:alpine

# Copy our custom Nginx config for React routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built files from Stage 1
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
