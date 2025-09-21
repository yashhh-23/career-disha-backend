# Quick Redis Setup for Windows

## Option 1: Docker (Recommended)
1. Install Docker Desktop for Windows from https://docker.com
2. Once installed, run this command:

```cmd
docker run -d --name redis-server -p 6379:6379 redis:7-alpine
```

3. To start Redis later:
```cmd
docker start redis-server
```

4. To stop Redis:
```cmd
docker stop redis-server
```

## Option 2: Windows Subsystem for Linux (WSL)
1. Install WSL2: `wsl --install`
2. In WSL terminal:
```bash
sudo apt update
sudo apt install redis-server
sudo service redis-server start
```

## Option 3: Redis for Windows (Legacy)
1. Download from: https://github.com/tporadowski/redis/releases
2. Extract and run redis-server.exe
3. Keep terminal open while using the application

## Verify Redis is Running
Test connection with:
```cmd
# If using Docker:
docker exec -it redis-server redis-cli ping

# Should return: PONG
```

## Alternative: Disable Redis
If you don't need caching, comment out REDIS_URL in your .env file:
```
# REDIS_URL="redis://localhost:6379"
```