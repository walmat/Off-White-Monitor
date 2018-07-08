var r = require('rethinkdb');
var log = require('../utils/log');
var table_list = ['products'];
let db = {};

db.connect = function(timeout, cb) {
    r.connect({
        timeout: timeout
    }).then(function(conn) {
        if (conn) {
            dropDB(conn, 'local', function(err, res) {
                log('s', `successfully cleared products from ${table_list[0]}`);
                createDB(conn, 'local');
                createTables(conn, 'local', table_list);
            });
            return cb(conn);
        }
        return cb(null);
    });
};

function createDB(conn, db_name) {
    r.dbList().contains(db_name).do(function(exists) {
        return r.branch(exists, { dbs_created: 0 }, r.dbCreate(db_name));
    }).run(conn);
}

function createTables(conn, db_name, tables) {
    r(tables)
        .difference(r.db(db_name).tableList())
        .forEach(table => r.db(db_name).tableCreate(table))
        .run(conn)
}

function dropDB(conn, db_name, cb) {
    r.dbList().contains(db_name).do(() => {
        return r.dbDrop(db_name);
    }).run(conn, cb);
};

db.addProduct = function(conn, table_name, product, cb) {

    if (conn) {
        r.db('local').table(table_name).insert({
            id: product.id,
            name: product.name,
            image: product.image,
            price: product.price,
            sizes: product.sizes,
            region: product.region
        }).run(conn, function(err, result) {
            if (err) return cb(err);
            return cb(JSON.stringify(result, null, 2));
        });
    } else {
        log('i', `no connection to the database found.`)
        cb(null);
    }
}

db.getProduct = function(conn, table_name, product, cb) {

    if (conn) {
        r.db('local')
            .table(table_name)
            .filter(r.row('id').eq(product.id))
            .run(conn, function(err, cursor) {
                if (err) return cb(err);
                    cursor.toArray(function(err, result) {
                        if (err) return cb(null);
                        return cb(JSON.stringify(result, null, 2));
                });
        });
    } else {
        log('i', `no connection to the database found.`)
        cb(null);
    }
}

db.updateProduct = function(conn, table_name, product, cb) {

    if (conn) {
        r.db('local')
            .table(table_name)
            .get(1)
            .update({
                price: product.price,
                sizes: product.sizes
            }).run(conn, function(err, result) {
                if (err) return cb(err);
                return cb(JSON.stringify(result, null, 2));
            });
    } else {
        log('i', `no connection to the database found.`)
        cb(null);
    }
}

module.exports = db;

