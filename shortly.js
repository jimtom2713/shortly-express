var express = require('express');
var session = require('express-session');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
// var cookieParser = require('cookie-parser');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');



app.use(partials());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
// app.use(cookieParser());
app.use(session({
  secret: 'keyboard cat'
}));
app.use(bodyParser.json());

var sess;

app.get('/', function(req, res){
  sess = req.session;
  // console.log('session --------> ', req.session);
  if(sess.username){
    res.render('index'); 
  }
  else{
    res.redirect('login');
  }
});

app.get('/create', 
function(req, res) {
  res.render('signup');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});


/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login', 
function(req, res) {
  res.render('login');
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.post('/signup', 
  function(req, res){
    sess = req.session;
    sess.username = req.body.username;
    sess.password = req.body.password;//TO DELETE LATER
    User.forge({
      username: sess.username,
      password: sess.password
    }).save().then(function(results){
      console.log('RESULTS ---------> ', results);
      db.knex('users')
        .where('username', '=', sess.username)
        .then(function(results){
        });
        res.redirect("/");
    }); 
  });

app.post('/login', 
function(req, res) {
  sess = req.session;

  new User({username: req.body.username}).fetch().then(function(result){
    // console.log(result);
    if (!result) {
      res.redirect('/signup');
    }else{
    

    result.comparePassword(req.body.password, function(isMatch) {
      if (isMatch) {

        // if found a match, regenerate the session
        req.session.regenerate(function(err) {
          req.session.username = req.body.username;
          res.redirect("/");
        });
        
      } else {
        // res.send("Wrong password");
        res.redirect('/login');
      }
    });
    }
  });
});

app.get('/logout', function(req, res){
  // console.log('session -------> ', req.session);
  req.session.destroy(function(err){
    // console.log('session destroyed');
    if(err) throw err;
    else {
      res.redirect('/login');
    }
  });
})

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
