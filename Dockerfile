FROM node:11-alpine

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

RUN rm -rf node_modules \
  && npm install --production \
	&& npm install pino-elasticsearch -g

#HEALTHCHECK --interval=12s --timeout=24s --start-period=60s \  
# CMD node lib/healthcheck.js

CMD [ "npm", "start" ]

EXPOSE 3978