FROM node:20-alpine

WORKDIR /app

# Install Angular CLI globally
RUN npm install -g @angular/cli@17

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application
COPY . .

# Expose port
EXPOSE 4200

# Run development server
CMD ["ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]
