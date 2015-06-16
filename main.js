var fs = require('fs');
var Q = require('q')
var request = require('request');
var parseString = require('xml2js').parseString;

var THE_GAMES_DB_GET_PLATFORMS_URL = 'http://thegamesdb.net/api/GetPlatformsList.php';
var THE_GAMES_DB_GET_PLATFORM_GAMES_URL = 'http://thegamesdb.net/api/GetPlatformGames.php?platform=';

// data that will be written out to the games.json at the end
var data = [];

Q.fcall(populatePlatforms)
    .then(populateGames)
    .then(populateDetails)
    .then(writeFile)
    .catch(function(err) {
        console.error(err);
    });


function populatePlatforms() {

    console.log('Fetching platforms...');

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

            // if I change the structure, pass the data back in the promise
            deferred.resolve(data);
        });
    });

    return deferred.promise();
}

function populateGames() {
    var deferred = Q.defer();
    data.forEach(function(platform) {

        console.log('Fetching games for ' + platform.name);

        platform.games = [];
        request(THE_GAMES_DB_GET_PLATFORM_GAMES_URL + platform.id, function(err, response, body) {
            if (err) {
                deferred.reject(err);
                return;
            }

            parseString(body, function(err, result) {
                if (err) {
                    deferred.reject(err);
                    return;
                }

                result.Data.Game.forEach(function(game) {
                    platform.games.push({
                        id: game.id ? game.id[0] : null,
                        title: game.GameTitle ? game.GameTitle[0] : null,
                        releaseDate: game.ReleaseDate ? game.ReleaseDate[0] : null
                    });
                });
            });
        });
    });

    return deferred.promise();
}

function populateDetails() {

}

function writeFile() {
    var deferred = Q.defer();
    var json = JSON.stringify(data, null, 4);
    fs.writeFileSync('games.json', json);
    return deferred.resolve().promise();
}
