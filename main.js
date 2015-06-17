var fs = require('fs');
var Q = require('q')
var request = require('request');
var parseString = require('xml2js').parseString;

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
        console.error(err);
    })
    .done(function() {
        console.log('--== FINISHED ==--');
    });

function populatePlatforms() {

    console.log('--Fetching platforms');

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

            console.log('   Fetched ' + data.length + ' platforms.');

            // if I change the structure, pass the data back in the promise
            deferred.resolve(data);
        });
    });

    return deferred.promise;
}

function populateGames() {

    var deferreds = [];
    data.forEach(function(platform, index, array) {

        deferreds.push(Q.defer());
        array[index].games = [];

        request(THE_GAMES_DB_GET_PLATFORM_GAMES_URL + platform.id, function(err, response, body) {

            console.log('   Fetching games for ' + platform.name);
            if (err) {
                deferreds[index].reject(err);
                return;
            }

            parseString(body, function(err, result) {
                if (err) {
                    deferreds[index].reject(err);
                    return;
                }

                result.Data.Game.forEach(function(game) {
                    array[index].games.push({
                        id: game.id ? game.id[0] : null,
                        title: game.GameTitle ? game.GameTitle[0] : null,
                        releaseDate: game.ReleaseDate ? game.ReleaseDate[0] : null
                    });
                });
                console.log('   Fetched ' + platform.games.length + ' for ' + platform.name);
                deferreds[index].resolve(data);
            });
        });
    });

    // get the promises off the array of deferreds
    return Q.allSettled(deferreds.map(function(d) {
        return d.promise;
    }));
}

function populateDetails() {
    var deferreds = [];

    data.forEach(function(platform, i, platforms) {
        platform.games.forEach(function(game, j, games) {
            var deferred = Q.defer();
            deferreds.push(deferred.promise);

            request(THE_GAMES_DB_GET_GAME_DETAILS_URL + game.id, function(err, response, body) {
                if (err) {
                    deferred.reject(err);
                    return;
                }

                parseString(body, function(err, result) {
                    if (err) {
                        deferred.reject(err);
                        return;
                    }

                    result.Data.Game.forEach(function(gameDetail) {
                        game.overview = gameDetail.Overview ? gameDetail.Overview[0] : null;
                        game.esrb = gameDetail.ESRB ? gameDetail.ESRB[0] : null;
                        game.publisher = gameDetail.Publisher ? gameDetail.Publisher[0] : null;
                        game.developer = gameDetail.Developer ? gameDetail.Developer[0] : null;
                        game.players = gameDetail.Players ? gameDetail.Players[0] : null;
                    });

                    console.log('   Fetched details for ' + game.title);

                    deferred.resolve(result);
                });
            });
        });
    });

    return Q.allSettled(deferreds);
}

function writeFile() {
    console.log('--Writing file: games.json');
    var deferred = Q.defer();
    var json = JSON.stringify(data, null, 4);
    fs.writeFileSync('games.json', json);
    deferred.resolve();
    return deferred.promise;
}
