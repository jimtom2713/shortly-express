var db = require('../config');
var Promise = require('bluebird');
var bcrypt = Promise.promisifyAll(require('bcrypt-nodejs'));

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

  initialize: function(){
    this.on('saving', this.hashPassword, this);
  },

  comparePassword: function(inputPassword, callback) {

    bcrypt.compare(inputPassword, this.get("password"), function(err, isMatch) {
      callback(isMatch);
    });
  },

  hashPassword: Promise.method(function(model) { 
    console.log("password in user model--------->", model.attributes.password);
    bcrypt.hash(model.attributes.password, null, null, function(err, hash) {
      console.log("hash in user model ---------> ", hash);

      model.set({'password': hash});
    });
  })
});

module.exports = User;