const _ = require('lodash');
global.gifDb = [];

const giphy = require('giphy-api')();

function _getGifs() {
  const opts = {
    limit: 25,
    rating: 'pg-13',
  };

  return giphy.trending(opts).then(function(gifs) {
    const flattenedGifs = [];
    gifs.data.forEach(function(gif) {
      flattenedGifs.push({
        id: gif.id,
        url: gif.images.original.url,
      });
    });

    global.gifDb = _.unionWith(global.gifDb, flattenedGifs, _.isEqual);
  }, function() {
    // ¯\_(ツ)_/¯ - API Limit
  });
}

setInterval(function() {
  _getGifs();
}, 10 * 60 * 1000); // add new gifs every 10 minutes

module.exports = new Promise(function(resolve) {
  _getGifs().then(function() {
    global.gifDb[0].shared = true;
    resolve();
  });
});
