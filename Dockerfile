FROM node:12-alpine

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

RUN mv certs/alfred_iot_battery_service-key.pem certs/server.key \
	&& mv certs/alfred_iot_battery_service.pem certs/server.crt 

RUN npm update \
	&& npm install --production 

HEALTHCHECK --start-period=60s --interval=10s --timeout=10s --retries=6 CMD ["./healthcheck.sh"]

EXPOSE 3978