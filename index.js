var getTileData = require('./modules/get-panorama-tiles');
var panorama = require('./modules/get-panorama-by-location');
var getPanoURL = require('./modules/get-pano-url');
var Canvas = require('canvas');
var async = require('async');
var request = require('request');
var Image = require('canvas').Image;
var fs = require('fs');

var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

function getPanoTileImages(id, zoom) {
    if (!id) {
        throw new Error('must specify panorama ID');
    }

    zoom = (typeof zoom === 'number' ? zoom : 1) | 0; // integer value
    if (zoom < 0 || zoom > 5) {
        throw new Error('zoom is out of range, must be between 0 - 5 (inclusive)');
    }

    var data = getTileData(zoom);
    var images = [];
    for (var y = 0; y < data.rows; y++) {
        for (var x = 0; x < data.columns; x++) {
            images.push({
                url: getPanoURL(id, {
                    x: x,
                    y: y,
                    zoom: zoom
                }),
                position: [x * data.tileWidth, y * data.tileHeight]
            });
        }
    }
    data.images = images;
    return data;
}

function getImageFromURL(url) {
    var img = new Image();
    var abc;
    request.get({
        url: url,
        encoding: null
    }, function(err, res, body) {
        img.src = body;
        return body;
    });
}

app.get('/json', function(req, res) {
    if (req.query.lat && req.query.lng) {} else {
        res.end('lat & lng required !');
    }
    var location = [req.query.lat, req.query.lng];
    var zoom = parseInt(req.query.zoom);
    panorama(location, function(err, result) {
        if (err) throw err;
        var data = getPanoTileImages(result.id, zoom);
        res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        res.end(JSON.stringify(data));
    });
});

app.get('/img', function(req, res) {
    if (req.query.lat && req.query.lng) {} else {
        res.end('lat & lng required !');
    }
    var location = [req.query.lat, req.query.lng];
    var zoom = parseInt(req.query.zoom);

    panorama(location, function(err, result) {
        if (err) throw err;
        var data = getPanoTileImages(result.id, zoom);
        res.writeHead(200, {
            'Content-Type': 'image/png'
        });
        var canvas = new Canvas(data.width, data.height);
        var ctx = canvas.getContext('2d');
        // res.end();
        async.mapSeries(data.images, function(image, cb) {
            console.log(image.url);
            request.get({
                url: image.url,
                encoding: null
            }, function(err, res, body) {
                var img = new Image();
                img.src = new Buffer(body, 'binary');
                ctx.drawImage(img, image.position[0], image.position[1], data.tileWidth, data.tileHeight);
                cb();
            });
        }, function(err, result) {
            /*res.end('<img src="' + canvas.toDataURL() + '"/>');*/
            var data = canvas.toDataURL().replace(/^data:image\/\w+;base64,/, "");
            var buf = new Buffer(data, 'base64');
            fs.writeFile(result.id + ".png", buf);
            fs.readFile(result.id + ".png", function(err, data) {
                if (err) throw err;
                res.write(data);
            });
            res.end();
        });
    });
});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});