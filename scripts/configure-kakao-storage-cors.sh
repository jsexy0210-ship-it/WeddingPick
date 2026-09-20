#!/usr/bin/env bash
set -euo pipefail

container="${KAKAO_API_CONTAINER:-weddingpick-api}"

sudo -n docker inspect "$container" >/dev/null
sudo -n docker exec -i \
  -e WP_EXECUTE_STORAGE_CORS=1 \
  "$container" node < scripts/configure-kakao-storage-cors.cjs
