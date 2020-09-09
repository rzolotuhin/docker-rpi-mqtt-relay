var fs = require('fs');
var ini = require('ini');
var mqtt = require('mqtt');
var gpio = require('onoff').Gpio;

console.sprintf = function() {
    if(arguments.length){
        let num = 0;
        let args = arguments;
        this.log(arguments[0].replace(/%s/g, function() {
            return args[++num];
        }));
    }
}

function timestamp() {
    return Math.round(new Date()/1000);
}

try {
    var config = ini.parse(fs.readFileSync('config.ini', 'utf-8'));
} catch (error) {
    console.sprintf('Ошибка чтения файла config.ini: %s', error.code);
    process.exit(1);
}

if (config.server.clientId === undefined) config.server.clientId = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
if (config.server.topic === undefined) config.server.topic = 'rpi-relay';

var time = {
    connect: 0
}

var port = {
    avaliable: [5, 6, 13, 16, 19, 20, 21, 26],
    default: {
        state: config.port.state.match(/^(on|off)$/i) ? config.port.state : 'off',
        inversion: (config.port.inversion !== true) ? false : true,
        ignoreSavedTopics: (config.port.ignoreSavedTopics !== true) ? false : true
    }
}

var client = mqtt.connect(config.server.address || 'mqtt://127.0.0.1', config.server);

port.avaliable.forEach(num => {
    let state = parseInt(port.default.state.replace(/^(on|off)$/i, function(state) {
        switch (state) {
            case  'on': return port.default.inversion ? 0 : 1;
            case 'off': return port.default.inversion ? 1 : 0;
        }
    }));

    port[num] = new gpio(num, 'out');
    port[num].write(parseInt(state));

    console.sprintf('Порт %s настроен на выход: %s', (num < 10) ? '0' + num : num, port.default.state);

    client.publish(config.server.topic + '/state/' + (port.avaliable.indexOf(num) + 1), (port.default.inversion ? (state ? 0 : 1) : (state ? 1 : 0)).toString(), {
        retain: true,
        qos: 1
    });
});

client.on('connect', function() {
    time.connect = timestamp();

    console.sprintf('Успешное подключение к серверу: %s', config.server.address);
    client.subscribe(config.server.topic + '/control/#', function (err) {
        if (!err) console.sprintf('Оформлена подписка на топик: %s/control/#\r\nСостояние портов будут публиковаться в топике: %s/state/<port>', config.server.topic, config.server.topic);
    })
});

client.on('reconnect', function() {
    time.connect = timestamp();
    console.log('Переподключение к серверу');
});

client.on('close', function() {
    console.log('Соединение с сервером разорвано');
});

client.on('disconnect', function(packet) {
    console.log('Отключение от сервера');
});

client.on('error', function(error) {
    console.sprintf('Код ошибки: %s', error.code);
});

client.on('message', function(topic, message) {
    if (port.default.ignoreSavedTopics) {
        if (time.connect + 5 > timestamp()) return false;
    }

    console.sprintf('Сообщение [%s]: %s', topic, message.toString());

    let match_top = topic.match(new RegExp(`^${config.server.topic}/control/([1-8])$`, "i"));
    let match_msg = message.toString().match(/^(on|off|[0-1])$/i);

    if (match_top && match_msg) {
        let num = match_top[1]-1;
        let state = match_msg[1].replace(/(on|off)/i, function(action) {
            switch (action) {
                case  'on': return 1;
                case 'off': return 0;
            }
        });

        if (port.avaliable[num] !== undefined) {
            port[port.avaliable[num]].write(port.default.inversion ?
                (parseInt(state) ? 0 : 1) :
                (parseInt(state) ? 1 : 0)
            );
            client.publish(config.server.topic + '/state/' + (num + 1), state, {
                retain: true,
                qos: 1
            });
        }
    }
});