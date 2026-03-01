FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create data and logs directories
RUN mkdir -p data data/images logs

# Start the scheduler
CMD ["npx", "tsx", "src/index.ts", "schedule"]
