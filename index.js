var log = require('./utils/log');
var db = require('./classes/rethink');
var { loadConfig } = require('./utils/config');
var fs = require('fs');
var moment = require('moment');
var proxies = [];
var i = 0;

log('i', `Initializing monitor at ${moment()}.`);

var reader = require('readline').createInterface({
  input: fs.createReadStream('proxies.txt'),
});

reader.on('line', line => {
  proxies.push(formatProxy(line));
});

function formatProxy(str) {
  //format is ip:port:user:pass
  let data = str.split(':');
  return (data.length === 2) ? `https://${data[0]}:${data[1]}` :
        (data.length === 4) ? `https://${data[2]}:${data[3]}@${data[0]}:${data[1]}`:
        null;
}

var scrape = require('./classes/scrape');
let index = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(config, conn) {

    for (let i = 0; i < config.locales.length; i++) {
        for (let j = 0; j < config.keywords.length; j++) {
            if (index >= proxies.length) index = 0;
            scrape.find(config, config.locales[i], config.keywords[j], proxies[index], conn, async function(err, type, res) {
                if (err) {    
                    log(type, `Error type: ${err} ${res}`);
                    index++;
                    await sleep(config.error);
                    return run(config, conn);
                }
                else {
                    log(type, res);
                    await sleep(config.delay);
                    return run(config, conn);
                }
            });
        }
    }
}

async function init() {

    var connection;

    log('i', `connecting to local database..`);
    db.connect(10000, function (conn) {
        connection = conn;
        log('s', `connected on ${conn.clientAddress()}:${conn.clientPort()}`);
    });

    log('w', `loading proxies..`);
    setTimeout(function() {
        if (proxies.length > 0) {
            log('s', `loaded ${proxies.length} proxies!`);
        } else {
            log('w', `no proxies loaded..`)
        }

        loadConfig(config => {
            run(config, connection);
        })
    }, 2000);
}

init();

