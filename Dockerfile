FROM arm32v7/node:latest
COPY qemu-arm-static /usr/bin
ENV dst /opt/nodejs/rpi-mqtt-relay
RUN mkdir -p $dst
WORKDIR $dst
COPY *.json .
COPY *.js .
RUN npm install
ENTRYPOINT ["nodejs", "rpi-mqtt-relay.js"]
