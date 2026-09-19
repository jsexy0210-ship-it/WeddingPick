FROM node:22-alpine AS runtime-deps

WORKDIR /app

# 운영에 필요한 workspace manifest만 먼저 복사한다.
# npm workspace 필터를 쓰면 mobile/web/UI와 루트 devDependencies를 설치하지 않는다.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN npm ci \
      --omit=dev \
      --workspace @weddingpick/api \
      --include-workspace-root=false \
    && npm cache clean --force


FROM node:22-alpine AS tsx-runtime

# API는 아직 TypeScript 소스를 직접 실행한다. Jest/TypeScript 전체 devDependency 대신
# tsx 실행기만 별도 경로에 고정 버전으로 둔다.
RUN npm install \
      --prefix /opt/tsx \
      --omit=dev \
      --no-audit \
      --no-fund \
      --save-exact \
      tsx@4.19.2 \
    && npm cache clean --force


FROM node:22-alpine AS runtime-base

WORKDIR /app
ENV NODE_ENV=production

# deps stage에는 package manifest + 선택된 production node_modules만 있다.
COPY --from=runtime-deps /app /app
COPY --from=tsx-runtime /opt/tsx /opt/tsx

# 런타임이 실제로 읽는 코드만 넣는다.
COPY apps/api/src ./apps/api/src
COPY packages/api-contract/src ./packages/api-contract/src
COPY packages/db/src ./packages/db/src
COPY packages/db/migrations ./packages/db/migrations
COPY packages/domain/src ./packages/domain/src

# Domain/API runtime imports these canonical JSON files directly.
COPY spec/glossary.json ./spec/glossary.json
COPY spec/font-subsets.json ./spec/font-subsets.json
COPY spec/strings.ko.json ./spec/strings.ko.json


# 운영 worker는 현재 상담 녹음 클리핑 경로를 호출하지 않는다.
# API와 동일한 최소 런타임을 쓰고, ffmpeg는 활성 production 이미지에서 제외한다.
FROM runtime-base AS worker-runtime
CMD ["/opt/tsx/node_modules/.bin/tsx", "apps/api/src/worker.ts"]


# 상담 녹음 분류 경로를 다시 연결할 때만 명시적으로 선택하는 보존 target이다.
# 현재 production deploy에서는 이 target을 build/deploy하지 않는다.
FROM runtime-base AS media-worker-runtime
RUN apk add --no-cache ffmpeg
CMD ["/opt/tsx/node_modules/.bin/tsx", "apps/api/src/worker.ts"]


# 기본 docker build 결과는 HTTP API 전용 이미지다. ffmpeg는 포함하지 않는다.
FROM runtime-base AS runtime
EXPOSE 3000
CMD ["/opt/tsx/node_modules/.bin/tsx", "apps/api/src/index.ts"]
