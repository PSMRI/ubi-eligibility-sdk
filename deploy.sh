#!/bin/bash
set -e  # Exit on any error

# -------------------------------
# Deploy Script (Eligibility SDK)
# -------------------------------

: "${BASE_DIR:?Need to set BASE_DIR}"
: "${REPO_NAME:?Need to set REPO_NAME}"
: "${REPO_URL:?Need to set REPO_URL}"
: "${BRANCH:?Need to set BRANCH}"
: "${TAG:=latest}"
: "${CONTAINER_NAME:?Need to set CONTAINER_NAME}"

cd "$BASE_DIR" || exit 1

# ----- Remove old repo completely -----
if [ -d "$REPO_NAME" ]; then
  echo "🧹 Removing existing repo $REPO_NAME..."
  rm -rf "$REPO_NAME"
fi

# ----- Clone latest code -----
echo "📥 Cloning repository $REPO_URL (branch: $BRANCH)..."
git clone -b "$BRANCH" "$REPO_URL" "$REPO_NAME"
cd "$REPO_NAME"

# ----- Show recent commits -----
git log -n 3 --oneline

# ----- Copy Dockerfile and .env -----
cp "$BASE_DIR/.env" .

# ----- Build Docker image with tag -----
echo "🐳 Building Docker image $REPO_NAME:$TAG..."
docker build -t "$REPO_NAME:$TAG" .

# ----- Stop and remove existing container if running -----
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
  echo "🛑 Stopping existing container $CONTAINER_NAME..."
  docker rm -f "$CONTAINER_NAME"
fi

# ----- Remove old image if exists (optional) -----
docker rmi "$REPO_NAME:latest" 2>/dev/null || true

# ----- Start service with Docker Compose -----
cd "$BASE_DIR"
echo "🚀 Starting $CONTAINER_NAME service with docker-compose..."
docker-co
