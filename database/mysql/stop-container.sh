#!/bin/bash

CONTAINER_NAME=$1
PORT=$2

if [ -z "$CONTAINER_NAME" ] || [ -z "$PORT" ]; then
  echo "Usage: $0 <container_name> <port>"
  exit 1
fi

# 컨테이너가 존재하면 중지 및 제거
CONTAINER_ID=$(podman ps -aq --filter "name=$CONTAINER_NAME")
if [ -n "$CONTAINER_ID" ]; then
  echo "Stopping container: $CONTAINER_NAME"
  podman stop $CONTAINER_ID
  podman rm $CONTAINER_ID
else
  echo "No container found with the name $CONTAINER_NAME"
fi

# 포트 해제
echo "Releasing port $PORT"
sudo iptables -t nat -D PREROUTING -p tcp --dport $PORT -j REDIRECT --to-ports $PORT 2>/dev/null || true

echo "Port $PORT has been released."