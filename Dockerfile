FROM matmen/node:16

# playwright dependencies
RUN apt-get update && \
	apt-get install -y \
    libwoff1 \
    libopus0 \
    libwebp6 \
    libwebpdemux2 \
    libenchant1c2a \
    libgudev-1.0-0 \
    libsecret-1-0 \
    libhyphen0 \
    libgdk-pixbuf2.0-0 \
    libegl1 \
    libxslt1.1 \
    libgles2 \
    libnss3 \
    libxss1 \
    libasound2 \
    fonts-noto-color-emoji \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libcups2 \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir /pxlapi/ && chown node /pxlapi/
COPY --chown=node . /pxlapi/
USER node
RUN cd /pxlapi/ && npm i

EXPOSE 3000
ENTRYPOINT ["node", "."]
