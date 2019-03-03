FROM node:11-alpine

RUN ln -snf /usr/share/zoneinfo/Europe/London /etc/localtime && echo Europe/London > /etc/timezone \
  && mkdir -p /home/nodejs/app \
  && apk --no-cache --virtual build-dependencies add \
	git \
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
    && npm update
    
RUN npm install --production

RUN npm install pino-elasticsearch -g

HEALTHCHECK --interval=12s --timeout=12s --start-period=30s \  
 CMD node lib/healthcheck.js

CMD [ "npm", "start" ]

EXPOSE 3978