# Vulnerable Dockerfile Example
# This demonstrates common security issues

FROM node:latest

WORKDIR /app

# SECURITY ISSUE: Missing non-root user, running as root
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# SECURITY ISSUE: Using latest tag (not pinned)
EXPOSE 3000

# SECURITY ISSUE: No USER directive - runs as root
CMD ["node", "index.js"]
