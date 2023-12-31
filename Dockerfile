FROM node:20

# playwright dependencies
RUN apt-get update && \
    npx playwright install-deps chromium && \
    npx playwright install-deps firefox && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir /pxlapi/ && chown node /pxlapi/
COPY --chown=node . /pxlapi/

USER node
WORKDIR /pxlapi/
RUN npm ci && \
    npx playwright install chromium && \
    npx playwright install firefox

EXPOSE 3000
ENTRYPOINT ["node", "."]
