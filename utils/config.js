var fs = require('fs');
const prompt = require('./prompt');
const log = require('./log');

function loadConfig(cb) {
  if (fs.existsSync('../config.json')) {
    log('s', 'Config file found, loading it..')
    const config = require('../config.json');
    cb(config);
  } else {
    setupConfig(config => {
      cb(config);
    });
  }
}

function setupConfig(cb) {
  prompt.get(
    [
      {
        name: 'keywords',
        required: false,
        description: '(e.g. - unc,mercurial,presto (leave blank to gather all products))',
      },
      {
        name: 'sizes',
        required: false,
        description: '(e.g. - 8.5,9.5 (leave blank for all))',
      },
      {
        name: 'delay',
        type: 'integer',
        required: true,
        description: 'Monitor Delay (ms) (Recommended: lower with more proxies)',
      }
    ],
    function(err, result) {
      var slack = {
        active: false,
        token: 'token goes here',
        channel: 'general',
        settings: {
          username: 'Off-White Monitor',
          icon_url: 'https://i.imgur.com/oRfJCjc.png',
        },
      };
      var loc = [
        "US", 
        "GB", 
        "JP", 
        "NL", 
        "CN", 
        "FR", 
        "DE", 
        "IT", 
        "PT", 
        "SE", 
        "CH", 
        "UA", 
        "CA", 
        "HK", 
        "AU", 
        "NZ",
        "BR"
    ]
      const kw = result.keywords;
      var sizesOptions;
      if (result.sizes == '') {
        sizesOptions = null;
      } else {
        sizesOptions = [result.sizes];
      }
      result.url = "https://off---white.com"
      result.keywords = [kw];
      result.sizes = sizesOptions;
      result.slack = slack;
      result.locales = loc;

      fs.writeFile('../config.json', JSON.stringify(result, null, 4), function(err) {
        if (err) {
            log('e', `Unable to generated config file, try again..`);
            return cb(null);
        }
        log('Config file generated! Starting monitor...');
        cb(result);
      });
    }
  );
}

module.exports = {
  setupConfig,
  loadConfig,
};
