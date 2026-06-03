FROM node:20-alpine

WORKDIR /app

# In development we will mount the volume and run npm run dev
# So we don't strictly need to copy everything, but it's good practice.
# The command will be overridden by docker-compose anyway.
COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev"]
