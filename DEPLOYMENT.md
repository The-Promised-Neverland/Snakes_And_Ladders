# EC2 GitHub Actions Deployment

This repository now includes CI/CD for:

- `SL_Backend` -> Docker container `SnakeLadder_Server`
- `SL_Frontend` -> Docker container `SnakeLadder_Frontend`

The pipeline:

1. Builds both Docker images on every push to `main`
2. Bundles the repository
3. Connects to your EC2 instance over SSH
4. Copies the bundle to EC2
5. Builds and restarts the containers with Docker Compose on EC2

## Files Added

- `.github/workflows/deploy-ec2.yml`
- `deploy/docker-compose.ec2.yml`
- `deploy/deploy-ec2.sh`
- `SL_Backend/Dockerfile`
- `SL_Frontend/Dockerfile`

## Required GitHub Secrets

Add these in `Settings -> Secrets and variables -> Actions`:

- `EC2_SSH_KEY` : private SSH key contents for the EC2 instance
- `ELASTIC_IP` : public IP or DNS of your EC2 instance

## Important Notes

- The workflow assumes the EC2 SSH username is `ec2-user`.
- The frontend is built with `http://ELASTIC_IP:9090` as its API base URL.
- Make sure Docker and Docker Compose are installed on EC2.
- Open the EC2 security group ports you want to expose, typically `3000` and `9090`, or put Nginx in front of them.

## Container Names

- Backend container: `SnakeLadder_Server`
- Frontend container: `SnakeLadder_Frontend`

## Trigger

Deployment runs on push to `main` and can also be started manually from GitHub Actions.
