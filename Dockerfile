FROM node:12-alpine

RUN ln -snf /usr/share/zoneinfo/Europe/London /etc/localtime && echo Europe/London > /etc/timezone \
  && mkdir -p /home/nodejs/app \
  && apk --no-cache --virtual build-dependencies add \
	g++ \
	gcc \
	libgcc \
	libstdc++ \
	linux-headers \
	make \
	python \
  && npm install --quiet node-gyp -g \
  && rm -rf /var/cache/apk/*

WORKDIR /home/nodejs/app

COPY . /home/nodejs/app

RUN npm update \
	&& npm install --production \
	&& npm install pino-elasticsearch -g
	
HEALTHCHECK --start-period=60s --interval=10s --timeout=10s --retries=6 CMD ["./healthcheck.sh"]

CMD [ "npm", "start" ]

EXPOSE 3978