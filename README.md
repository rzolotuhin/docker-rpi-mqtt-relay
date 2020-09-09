# docker-rpi-mqtt-relay
Данный исходник позволяет реализовать управление платой с блоком реле из 8-и каналов которая является платой расширения для Raspberry Pi
Первое оригинальное упоминание плыты я [встретил тут](https://www.waveshare.com/wiki/RPi_Relay_Board_(B))

Готовую плату можно приобрести, например, [тут](https://aliexpress.ru/wholesale?SearchText=RPi+Relay+Board+B)

Управление производится с помощью MQTT протокола, который является очень распространенным способом передачи информации и поддерживается многими системами умного дома и т.п.

![Raspberry Pi MQTT Relay](https://github.com/rzolotuhin/docker-rpi-mqtt-relay/raw/master/images/rpi-mqtt-relay-1.jpg)

# Целевая система
Предполагается, что Вы используете оригинальную плату Raspberry Pi, а также [официальный образ операционной системы Raspbian](https://www.raspberrypi.org/downloads/raspberry-pi-os/).
Далее у Вас есть два варианта запуска программы.
* Через Docker контейнер  (предпочтительно)
* Самостоятельно через nodejs

Обязательно при любом варианте запуска (Не пропускайте этот пункт!!!)
-----------------------
Независимо от того, какой вариант Вы выберите, необходимо обязательно создать файл конфигурации в котором будет описание куда и как подключаться, а также дополнительные параметры отвечающие за поведение логики программы.
Скачайте и распакуйте файлы проекта
```bash
cd /opt/ && wget https://github.com/rzolotuhin/docker-rpi-mqtt-relay/archive/master.zip -O /opt/docker-rpi-mqtt-relay-master.zip && unzip docker-rpi-mqtt-relay-master.zip
```
Отредактируйте файл `config.ini` в зависимости от ваших потребностей
Изначально файл выглядит следующим образом
```
[server]
address = mqtt://10.10.11.3
port = 1883
clientId = rpi-relay
topic = rpi-relay
reconnectPeriod = 5000
#rejectUnauthorized = false
#username =
#password =

[port]
inversion = true
state = off
ignoreSavedTopics = false
```
Раздел `server` наследует все параметры пакета `mqtt` описанные тут: https://www.npmjs.com/package/mqtt#mqttclientstreambuilder-options

Вы можете детально ознакомиться с ними и подстроить работу под себя.

Раздел `port` отвечает за работу с аппаратной частью Raspberry Pi
* __`inversion`__ - принимает значение `true` или `false` и отвечает за то, необходимо ли инвертировать выходной сигнал с портов Raspberry для включения реле. Данный параметр напрямую зависит от аппаратной реализации платы расширения. В большинстве случаев различные платы используют включение реле с помощью низкого логического уровня, в таком случае необходима инверсия и выставление параметра `true`.
* __`state`__ - параметр описывает начальное состояние, всех реле, которое будет установлено при запуске программы. Принимает значение `on` или `off`. В зависимости  от выставленного значения и параметра `inversion`, на порт управления будет подан логическая `1` или `0`.
* __`ignoreSavedTopics`__ - описывает, стоит ли восстанавливать состояние реле опираясь на данные полученные по MQTT из топиков управление в которые были переданы данные с пометкой `retain`. Этот параметр позволяет восстановить состояние реле после перезапуска программы, операционной системы или после восстановления питания на Raspberry.

Обратите внимание, что `config.ini` необходим при любом типе запуска. Если вы используете Docker, то остальные файлы не требуются.

Запуск через Docker контейнер (предпочтительно)
-----------------------
Используйте официальную документацию по установке Docker на Ubuntu, выберите один из более удобных Вам способов https://docs.docker.com/engine/install/ubuntu/

Если Вы считаете, что у Вас мало опыта, то используйте вариант установки через скрипт. Он описан последним в официальной документации.

После того, как Docker установлен, достаточно выполнить всего одну команду для загрузки и запуска контейнера
```bash
docker run --restart always --privileged -d --name rpi-mqtt-relay -v /opt/docker-rpi-mqtt-relay-master/config.ini:/opt/nodejs/rpi-mqtt-relay/config.ini -v /sys/class/gpio/:/sys/class/gpio/ -it rzolotuhin/rpi-mqtt-relay
```
Стоит обратить внимание на то, что контенер запускается с повышенными привилегиями т.к это обеспечит полноценный доступ к каталогу `/sys/class/gpio/` на хост машине (Raspberry Pi)
Также Ваш конфиг `/opt/docker-rpi-mqtt-relay-master/config.ini` будет примонтирован к контейнеру по пути `/opt/nodejs/rpi-mqtt-relay/config.ini`
Таким образом программа получит доступ к нему и будет следовать тем предписаниям, что вы указали.

Запуск самостоятельно через nodejs
-----------------------
Данный вариант следует считать менее предпочтительным т.к он потребует дополнительных действий, может быть не совместим с некоторым ПО и т.п.

В первую очередь необходимо установить nodejs, выполните команды описанные в [этой инструкции](https://github.com/nodesource/distributions/blob/master/README.md#deb) для последней версии данного пакета.

После этого необходимо перейти в каталог с скачанными ранее файлами и выполнить установку необходимых библиотек для nodejs.
```bash
cd /opt/docker-rpi-mqtt-relay-master/ && npm install
```
Данная команда, на основании данных в файле `package.json` доставит все необходимое.
Для запуска ПО достаточно выполнить следующую команду
```bash
nodejs /opt/docker-rpi-mqtt-relay-master/rpi-mqtt-relay.js
```

Как управлять?
-----------------------
После подключения к MQTT серверу, произойдет подписка на топики указанные в файле конфигурации в виде параметра `topic` с добавлением субтопика `control`.
Таким образом, если в параметре указан топик `rpi-relay`, то подписка будет оформлена все все топики входящии в `rpi-relay/control`.

Если вы хотите изменить состояние реле №1 (канал 1), то необходимо отправить `on`, `off` или `1`, `0` в топик `rpi-relay/control/1`. И аналогично для всех реле (канало) 1-8.

Обратная связь для другой автоматики (Home Assistant и т.п)
-----------------------
О всех изменениях состояния реле (каналов) будет сообщение в соответствующем субтопике `state`, аналогично пункту, описанному ранее `rpi-relay/state/1` для реле 1 и т.д.

Какие GPIO используются?
-----------------------
Для управления каналами реле с 1 по 8 используются порты: 5, 6, 13, 16, 19, 20, 21 и 26

Еще немного фото
-----------------------
![Raspberry Pi MQTT Relay](https://github.com/rzolotuhin/docker-rpi-mqtt-relay/raw/master/images/rpi-mqtt-relay-2.jpg)
![Raspberry Pi MQTT Relay](https://github.com/rzolotuhin/docker-rpi-mqtt-relay/raw/master/images/rpi-mqtt-relay-3.jpg)
