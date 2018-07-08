var cheerio = require('cheerio');
var cloudscraper = require('cloudscraper');
var nofity = require('../utils/notify');
var request = require('request');
var uuidv5 = require('uuid/v5');
var r = require('rethinkdb');
var log = require('../utils/log');
var moment = require('moment');
var db = require('./rethink');
var scrape = {};

userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3107.4 Safari/537.36';

scrape.find = function(config, locale, keyword, proxy, conn, cb) {


    let url = `${config.url}/en/${locale}`
    if (keyword) {
        url = `${url}/search?utf8=%E2%9C%93&q=${keyword}`
    } else {
        url = `${url}/section/new-arrivals`
    }

    cloudscraper.request({
        method: 'GET',
        url:url,
        headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/json'
        },
        proxy: proxy,
    }, function(err, res, body) {

        log('i', res);

        if (!res) {
            return cb(true, 'e', 'No connection to the internet..');
        } else {
            if (err) {
                return cb(err.errorType, 'e', `during fetching website.`);
            } else {
                if (res.statusCode === 502) {
                    cb(res.statusCode, 'e', `rotating proxy.`)
                } else if (res.statusCode === 429) {
                    cb(res.statusCode, 'w', `swapping delay`);
                } else if (res.statusCode >= 200 && res.statusCode < 300) {
                    let json_url;
                    let name;
                    let price;
                    let image_url;
                    let sizes = [];
                    var $ = cheerio.load(body, {xmlMode:true});
                    $('#content > section > section').find('article').each(function(index, product) {
                        json_url = $(product).data('json-url');
                        // log('d', json_url);
                        let img_src = $(product).find('a > figure > img').first().attr('src');
                        image_url = img_src.substring(0, img_src.indexOf('?'));
                        // log('d', image_url);
                        price = $(product).find('a > figure > figcaption > div.price > span:nth-child(1)').first().text().trim();
                        // log('d', price);
                        name = $(product).find('a > figure > figcaption > div.brand-name').first().text().trim();
                        // log('d', name);
        
                        cloudscraper.request({
                            method: 'GET',
                            url: `${config.url}${json_url}`,
                            headers: {
                                'User-Agent': userAgent,
                                'Content-Type': 'application/json'
                            },
                            proxy: proxy
                        }, function(err, res, body) {
        
                            if (err) {
                                log('e', err);
                                return cb(err.errorType, 'e', `Error: ${err.errorType} during fetching website.`);
                            }
                            const data = JSON.parse(body).available_sizes;
                            if (data) {
                                data.forEach(size => {
                                    sizes.push(size);
                                });
                            }
                            
                            let p = {
                                "id": uuidv5(`${json_url}@${product.region}`, uuidv5.URL),
                                "name": name,
                                "image": image_url,
                                "price": price,
                                "sizes": sizes,
                                "region": locale
                            };
        
                            //check product against database
                            db.getProduct(conn, 'products', p, function(res) {
                                let er = JSON.parse(res);
                                log('w', `Product found: ${er.name}`);
                                if (er.length === 0) {
                                    db.addProduct(conn, 'products', p, function(res) {
                                        if (res) {
                                            notify(config.slack, config.discord, p);
                                            return cb(null, 's', `Added ${p.name} in ${p.region}.`);
                                        } else {
                                            return cb(err, 'e', `Unable to save product in database.`);
                                        }
                                    });
                                } else {
                                    log('i', `${res.price}|${p.price} // ${res.sizes}|${p.sizes[0]}`);
                                    if (er.price !== p.price || er.sizes !== p.sizes) {
                                        db.updateProduct(conn, 'products', p, function(res) {
                                            if (res) {
                                                notify(config.slack, config.discord, p);
                                                return cb(null, 's', `Updated ${p.name} in ${p.region}.`);
                                            } else {
                                                return cb(err, 'e', `Unable to update product in database.`);
                                            }
                                        });
                                    }
                                }
                            });   
                        });
                    });
                }
            }                
        }
    });
};

function notify(discord, slack, product) {}

module.exports = scrape;