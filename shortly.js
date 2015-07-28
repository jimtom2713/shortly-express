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
// Parse JSON (uniform resource locators)

// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
// app.use(cookieParser());
app.use(session({
  secret: 'keyboard cat'
  // resave: false,
  // saveUninitialized: true,
  // cookie: { secure: true }
}));
app.use(bodyParser.json());

var sess;

app.get('/', function(req, res){
  // console.log(req);
  sess = req.session;
  //console.log(sess.username);
  // console.log(req.session);
  if(sess.username){
    res.render('index'); 
  }
  else{
    res.redirect('login');
  }
});

// app.get('/home',
// function(req, res) {
//   res.render('index');
// });

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
    //encrypt this without storing it in plain text
    sess.password = req.body.password;//TO DELETE LATER

    User.forge({
      username: sess.username,
      //again, make sure this is encrypted by this point
      //check the db model to see if there are helper functions
      // bcrypt ????
      password: sess.password
    }).save().then(function(){
      db.knex('users')
        .where('username', '=', sess.username)
        .then(function(results){
          console.log("----------> RESULTS: ", results);
        });
        console.log("-----------> REDIRECTING TO HOME");
        res.redirect("/");
    });
  });

app.post('/login', 
function(req, res) {
  sess = req.session;
  sess.username = req.body.username;
  //this is where we should encrypt the password
  //don't store it on the session
  //just pass the encrypted password along to the database query without saving it
  sess.password = req.body.password;

  db.knex('users')
    .where('username', '=', sess.username)
    .then(function(results){
      console.log("-------------> LOGIN RESULTS: ", results);
      if (results[0] && results[0]['username']){
        // the user is in the database
        var password = results[0]['password'];

        // check if the password is correct
        if (password === sess.password){
          res.redirect("/");
        } else {
          console.log("-----------------> WRONG PASSWORD");
          res.send("Wrong password");
        }
        console.log("-----------------> THE PASSWORD", password);
      } else {
        // user not in database, redirect to signup
        console.log("-----------------> REDIRECTING TO SIGNUP");
        res.redirect('/signup');
      }
    });
  // check if username is in the database, if it is check password
  // if username not in database, reroute to signup
  //res.redirect('/');
});

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
