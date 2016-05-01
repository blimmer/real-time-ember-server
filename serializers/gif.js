const _ = require('lodash'),
      JSONAPISerializer = require('jsonapi-serializer').Serializer;

const serializer = new JSONAPISerializer('gif', {
  attributes: ['url', 'shared'],
});

module.exports = function serializeGif(data) {
  if (_.isArray(data)) {
    data = _.chain(data)
            .compact()
            .uniqWith(_.isEqual);
  }

  return serializer.serialize(data);
};
