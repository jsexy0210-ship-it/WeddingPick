FROM node:22-alpine

WORKDIR /app

# ffmpeg — 상담 녹음의 1차 판정용 조각을 잘라낸다.
#
# **자르지 않으면 2단계가 절약이 아니라 두 배다.** 1차에서도 전체를 보내게 되고,
# 음성은 길이만큼 과금되므로 한 시간짜리 녹음 하나에 48원이 두 번 나간다.
#
# Gemini 쪽 클리핑(`videoMetadata`)에 기대지 않는 이유는 그것이 영상용이고 음성은
# 잘리지 않는다는 회귀 보고가 있기 때문이다(2026-09-14 확인). 잘렸는지 아닌지를
# 우리가 확인할 수 없는 자리에 비용을 맡기지 않는다.
#
# 재인코딩하지 않고 복사로만 자른다(`-c copy`) — 수백 밀리초다. 이미지가
# 30~40MB 늘고, 매뉴얼 배포마다 빌드가 조금 길어진다. 그 값을 알고 넣는다.
RUN apk add --no-cache ffmpeg

COPY . .

RUN npm ci

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@weddingpick/api"]
