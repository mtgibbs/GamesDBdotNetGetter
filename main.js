var fs = require('fs');
var Q = require('q')
var request = require('request');
var async = require('async');
var parseString = require('xml2js').parseString;
var winston = require('winston');

var logger = new winston.Logger({
    transports: [
        new(winston.transports.Console)(),
        new(winston.transports.File)({
            filename: 'test.log'
        })
    ]
});

var THE_GAMES_DB_GET_PLATFORMS_URL = 'http://thegamesdb.net/api/GetPlatformsList.php';
var THE_GAMES_DB_GET_PLATFORM_GAMES_URL = 'http://thegamesdb.net/api/GetPlatformGames.php?platform=';
var THE_GAMES_DB_GET_GAME_DETAILS_URL = 'http://thegamesdb.net/api/GetGame.php?id=';

// data that will be written out to the games.json at the end
var data = [];

populatePlatforms()
    .then(populateGames)
    .then(populateDetails)
    .then(writeFile)
    .catch(function(err) {
        logger.error(err);
    })
    .done(function() {
        logger.info('--== FINISHED ==--');
    });

function populatePlatforms() {

    logger.info('--Fetching platforms');

    var deferred = Q.defer();

    request(THE_GAMES_DB_GET_PLATFORMS_URL, function(err, response, body) {
        if (err) {
            deferred.reject(err);
            return;
        }

        parseString(body, function(err, result) {
            if (err) {
                deferred.reject(err);
                return;
            }

            // for some reason everything is ending up as a length 1 array
            result.Data.Platforms[0].Platform.forEach(function(platform) {
                data.push({
                    id: platform.id ? platform.id[0] : null,
                    name: platform.name ? platform.name[0] : null,
                    alias: platform.alias ? platform.alias[0] : null
                });
            });

            logger.info('   Fetched ' + data.length + ' platforms.');

            // if I change the structure, pass the data back in the promise
            deferred.resolve(data);
        });
    });

    return deferred.promise;
}

function populateGames() {

    var promises = [];
    async.forEach(data, function(platform) {

        var deferred = Q.defer();
        promises.push(deferred.promise);
        platform.games = [];

        request(THE_GAMES_DB_GET_PLATFORM_GAMES_URL + platform.id, function(err, response, body) {

            logger.info('   Fetching games for ' + platform.name);
            if (err) {
                deferred.resolve(err);
                logger.error('  Failed to fetch games for ' + platform.name);
                return;
            }

            parseString(body, function(err, result) {
                if (err) {
                    deferred.resolve(err);
                    logger.error('  Failed to fetch games for ' + platform.name);
                    return;
                }

                result.Data.Game.forEach(function(game) {
                    platform.games.push({
                        id: game.id ? game.id[0] : null,
                        title: game.GameTitle ? game.GameTitle[0] : null,
                        releaseDate: game.ReleaseDate ? game.ReleaseDate[0] : null
                    });
                });
                logger.info('   Fetched ' + platform.games.length + ' for ' + platform.name);
                deferred.resolve(data);
            });
        });
    });

    // get the promises off the array of deferreds
    return Q.allSettled(promises);
}

function populateDetails() {
    var promises = [];

    async.forEach(data, function(platform) {
        async.forEach(platform.games, function(game) {
            var deferred = Q.defer();
            promises.push(deferred.promise);

            request(THE_GAMES_DB_GET_GAME_DETAILS_URL + game.id, function(err, response, body) {
                if (err) {
                    deferred.resolve(err);
                    logger.error('Failed to get details for ' + game.title);
                    logger.error(err);
                    return;
                }

                parseString(body, function(err, result) {
                    if (err) {
                        deferred.resolve(err);
                        logger.error('Failed to get details for ' + game.title);
                        logger.error(err);
                        return;
                    }

                    result.Data.Game.forEach(function(gameDetail) {
                        game.overview = gameDetail.Overview ? gameDetail.Overview[0] : null;
                        game.esrb = gameDetail.ESRB ? gameDetail.ESRB[0] : null;
                        game.publisher = gameDetail.Publisher ? gameDetail.Publisher[0] : null;
                        game.developer = gameDetail.Developer ? gameDetail.Developer[0] : null;
                        game.players = gameDetail.Players ? gameDetail.Players[0] : null;
                    });

                    logger.info('   Fetched details for ' + game.title);

                    deferred.resolve(result);
                });
            });
        });
    });

    return Q.allSettled(promises);
}

function writeFile() {
    console.log('--Writing file: games.json');
    var deferred = Q.defer();
    var json = JSON.stringify(data, null, 4);
    fs.writeFileSync('games.json', json);
    deferred.resolve();
    return deferred.promise;
}
