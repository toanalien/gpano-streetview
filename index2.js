var getTileData = require('./modules/get-panorama-tiles');
var panorama = require('./modules/get-panorama-by-location');
var getPanoURL = require('./modules/get-pano-url');
var Canvas = require('canvas');
var async = require('async');
var request = require('request');
var Image = require('canvas').Image;
var fs = require('fs');

var path = require('path');

var express = require('express');
var app = express();

app.set('port', (80));
app.use(express.static('images/'));

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

var getImg = function (url, cb) {
    request.get({url: url, encoding: null}, function (err, res, body) {
        if (err) return cb(err);
        return cb(null, body);
    })
}

app.get('/img', function (req, res) {
    if (!req.query.lat || !req.query.lng || !req.query.zoom) {
        res.send('error');
    } else {
        var location = [req.query.lat, req.query.lng];
        var zoom = parseInt(req.query.zoom);
        panorama(location, function (err, result) {
            if (err) res.send('error');
            else {
                fs.exists(path.join(__dirname + '/images/' + result.id + "z" + zoom + ".png"), function (exists) {
                    if (!exists) {
                        var data = getPanoTileImages(result.id, zoom);
                        var canvas = new Canvas(data.width, data.height);
                        var ctx = canvas.getContext('2d');
                        async.mapSeries(data.images, function (image, cb) {
                            getImg(image.url, function (err, body) {
                                if (err) return console.log(err);
                                var img = new Image();
                                img.src = new Buffer(body, 'binary');
                                ctx.drawImage(img, image.position[0], image.position[1], data.tileWidth, data.tileHeight);
                                cb();
                            });
                        }, function () {
                            var data = canvas.toDataURL().replace(/^data:image\/\w+;base64,/, "");
                            var buf = new Buffer(data, 'base64');
                            fs.writeFile(path.join(__dirname + '/images/' + result.id + "z" + zoom + ".png"), buf);
                            res.send(result.id + "z" + zoom + ".png");
                        })
                    }
                    else
                        res.send(result.id + "z" + zoom + ".png");
                })
            }
        })
    }
});

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});
