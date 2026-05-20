#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/home/ec2-user/snakeladder}"
ENV_FILE="$APP_DIR/.env"
COMPOSE_FILE="$APP_DIR/docker-compose.ec2.yml"

mkdir -p "$APP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required on EC2" >&2
  exit 1
fi

DOCKER_CMD="docker"
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
  else
    echo "docker is installed but not accessible for the current user" >&2
    exit 1
  fi
fi

if $DOCKER_CMD compose version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER_CMD compose"
elif command -v docker-compose >/dev/null 2>&1; then
  if [ "$DOCKER_CMD" = "docker" ]; then
    COMPOSE_CMD="docker-compose"
  else
    COMPOSE_CMD="sudo docker-compose"
  fi
else
  echo "docker compose is required on EC2" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo ".env file not found at $ENV_FILE" >&2
  exit 1
fi

. "$ENV_FILE"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "docker compose file not found at $COMPOSE_FILE" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME:-}" ] || [ -z "${DOCKERHUB_TOKEN:-}" ]; then
  echo "DOCKERHUB_USERNAME and DOCKERHUB_TOKEN must be set in $ENV_FILE" >&2
  exit 1
fi

echo "$DOCKERHUB_TOKEN" | $DOCKER_CMD login -u "$DOCKERHUB_USERNAME" --password-stdin

echo "Disk usage before Docker cleanup:"
df -h || true
echo "Docker usage before cleanup:"
$DOCKER_CMD system df || true

$COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down --remove-orphans || true
$DOCKER_CMD system prune -af || true

echo "Disk usage after Docker cleanup:"
df -h || true
echo "Docker usage after cleanup:"
$DOCKER_CMD system df || true

$COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
$COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

$DOCKER_CMD image prune -f || true
