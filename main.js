var fs = require("fs");
var request = require('request');
var parseString = require('xml2js').parseString;

request('http://thegamesdb.net/api/GetPlatformsList.php', function(err, response, body) {

    if (err) {
        console.error('Error getting platforms list!');
        return;
    }

    parseString(body, function(err, result) {
        var platforms = [];

        // for some reason everything is ending up as a length 1 array
        result.Data.Platforms[0].Platform.forEach(function(platform) {
            platforms.push({
                id: platform.id ? platform.id[0] : null,
                name: platform.name ? platform.name[0] : null,
                alias: platform.alias ? platform.alias[0] : null
            });
        });

        var getPlatformGamesEndpoint = 'http://thegamesdb.net/api/GetPlatformGames.php?platform=';
        platforms.forEach(function(platform) {

            console.log('Fetching games for ' + platform.name);
            
            platform.games = [];
            request(getPlatformGamesEndpoint + platform.id, function(err, response, body) {
                if (err) {
                    console.error('Error getting games list for ' + platform.name);
                } else {
                    parseString(body, function(err, result) {
                        if (err) {
                            console.log(err);
                            return;
                        }

                        result.Data.Game.forEach(function(game) {
                            platform.games.push({
                                id: game.id ? game.id[0] : null,
                                title: game.GameTitle ? game.GameTitle[0] : null,
                                releaseDate: game.ReleaseDate ? game.ReleaseDate[0] : null
                            });
                        });

                        var json = JSON.stringify(platforms, null, 4);

                        fs.writeFileSync('games.json', json);
                    });
                }
            });
        });
    });
});
