//var fs = require{'fs'};
var express = require('express');
var app = express();
var session = require('cookie-session');
var bodyParser = require('body-parser');
var qs = require ('querystring');
var http = require('http');
var url  = require('url');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var formidable = require("formidable");
var mongourl = 'mongodb://123:a123456@ds149682.mlab.com:49682/s1124350';

var user = {};


app.use(session({
  name: 'session',
  keys: ['session']
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/',function(req,res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	} else {
		res.status(200);
		res.redirect('/list');
	}
});


app.get('/signup',function(req,res) {
	res.render('signup');
});

app.get('/login',function(req,res) {
	res.render('loginForm');
});

app.get('/create', function(req, res){
	res.render('new', {});
});


app.post('/signup',function(req,res) {
	var new_member= {};
	new_member['name'] = req.body.name;
	new_member['password'] = req.body.password;
	MongoClient.connect(mongourl, function(err, db) {
	  assert.equal(null, err);
	  insertMember(db, new_member, function() {
	      db.close();
	  });
	});
	res.redirect('/login');
});

app.post('/login',function(req,res) {
  // var user = {};
  user['name'] = req.body.name;
  user['password'] = req.body.password;
  console.log(user);
  MongoClient.connect(mongourl, function(err, db) {
    console.log("Connected");
    assert.equal(null, err);
    findMember(db, user, function(members){
        db.close();
				console.log("searching user");
        console.log(members.length);
        if (members.length == 0){
          console.log("not found")
          res.set({"Content-Type":"text/html"});
          res.end("<h1>user not found</h1>");
        }
				for (var i=0; i<members.length; i++) {
					if (members.length > 0){
						if (user.name == members[i].name &&
								user.password == members[i].password) {
								req.session.authenticated = true;
								req.session.username = user.name;
								console.log(req.session.authenticated);
                console.log(req.session.username);
								res.redirect('/list');
						}
					}
		  	}

      });
  });
});

app.get('/logout',function(req,res) {
	req.session = null;
	res.redirect('/');
});

app.post('/new', function(req, res){
	console.log("enter");
	var form = new formidable.IncomingForm();
	console.log("enter2");
    form.parse(req, function (err, fields, files) {
		console.log(fields);
		//console.log(JSON.stringify(files));;
		var filename = files.fileupload.path;

		fs.readFile(filename, function(err,data) {
			var new_restaurant = {};
			new_restaurant['name'] = fields.name;
			new_restaurant['borough'] = fields.borough;
			new_restaurant['cusisine'] = fields.cusisine;
			new_restaurant['street'] = fields.street;
			new_restaurant['building'] = fields.building;
			new_restaurant['zipcode'] = fields.zipcode;

			if(fields.lon != null && fields.lat != null){
				new_restaurant['lon'] = fields.lon;
				new_restaurant['lat'] = fields.lat;
				//new_restaurant['address'] = [fields.lon, fields.lat];
			}

			if (files.filetoupload.size > 0){
				new_restaurant['photo'] = new Buffer(data).toString('base64');
				new_restaurant['mimetype'] = files.filetoupload.type;
			}

			//new_restaurant['owner'] = req.session.user;
			MongoClient.connect(mongourl, function(err, db){
        console.log("Connected db")
				assert.equal(null, err);
				create(db, new_restaurant, function(){
					db.close();
				});
			});


		});
	});

});

app.get('/list',function(req,res) {
  MongoClient.connect(mongourl, function(err, db) {
    console.log("Connected");
    assert.equal(null, err);
    findRestaurants(db,{},function(restaurants) {
      db.close();
      console.log('Disconnected MongoDB');
      res.render("list.ejs",{restaurants:restaurants});
    });
  });
});

app.get('/display', function(req,res) {
  MongoClient.connect(mongourl, function(err,db) {
    try {
      assert.equal(err,null);
    } catch (err) {
      res.set({"Content-Type":"text/plain"});
      res.status(500).end("MongoClient connect() failed!");
    }
    console.log('Connected to MongoDB');
    var criteria = {};
    criteria['_id'] = ObjectId(req.query._id);
    console.log(criteria._id);
    showDetail(db,criteria._id, function(restaurant) {
      db.close();
      console.log(restaurant);
      res.render("detail.ejs", {r:restaurant});
      // console.log('Disconnected MongoDB');
      // console.log('Photo returned = ' + photo.length);
      // var image = new Buffer(photo[0].image,'base64');
      // var contentType = {};
      // contentType['Content-Type'] = photo[0].mimetype;
      // console.log(contentType['Content-Type']);
      // if (contentType['Content-Type'] == "image/jpeg") {
      //   res.render('photo.ejs',{photo:photo});
      // } else {
      //   res.set({"Content-Type":"text/plain"});
      //   res.status(500).end("Not JPEG format!!!");
      //}
    });
  });
});

app.get("/gmap", function(req,res) {
  var parsedURL = url.parse(req.url,true);
  var queryAsObject = parsedURL.query;
  var criteria = {};
  //criteria['lat'] = req.query.lat;
	criteria['lon'] = req.query.lon;
	res.render("map.ejs", {
    //lat:criteria.lat,
  	lon:criteria.lon,
	});
  console.log(lon);
  //console.log(lon);
	res.end();
});

app.get('/update',function(req,res){
		if (req.session.authenticated == false){
			req.end("You are not the owner");
		}else{
      MongoClient.connect(mongourl, function(err, db) {
        var parsedURL = url.parse(req.url,true); //true to get query as object
        var queryAsObject = parsedURL.query;
							assert.equal(err,null);
							console.log('Connected to MongoDB\n');
        if (err) throw err;
				var criteria = {};
				criteria['_id'] = ObjectId(queryAsObject._id);
        console.log(criteria._id);
				db.collection('restaurantNew').findOne(criteria, function(err, result){
            db.close();
            console.log(result);
            res.render('UpdateForm', {r:result});
        });
        });
      }
});

app.post('/updatedRestaurant', function(req,res){
  var newValues = {};
  var criteria = {};
	criteria['_id'] = req.body._id;
  var name = req.body.restname;
		  //var filename = files.filetoupload.path;

		  // if (files.filetoupload.type) {
			//   var mimetype = files.filetoupload.type;
		  // }

		  // if (fields.borough) {
			// var borough = fields.borough;
		  // }
      //
		  // if (fields.cuisine) {
			// var cuisine = fields.cuisine;
		  // }
      //
		  // if (fields.street) {
			// var street = fields.street;
		  // }
      //
		  // if (fields.building) {
			// var building = fields.building;
		  // }
      //
		  // if (fields.zipcode) {
			// var zipcode = fields.zipcode;
		  // }
      //
		  // if (fields.lon && fields.lat) {
			//   var lon = fields.lon;
			//   var lat = fields.lat;
		  // }

		// fs.readFile(filename, function(err,data) {
			MongoClient.connect(mongourl, function(err,db) {
			try {
			  assert.equal(err,null);
			  console.log('MongoDB connection successful.')
			} catch (err) {
			  res.set({"Content-Type":"text/plain"});
			  res.status(500).end("MongoClient connect() failed!");
			}
      newValues['name'] = restname;
			// var update_r = {};
			// update_r['name'] = name;
			// update_r['borough'] = borough;
			// update_r['cuisine'] = cuisine;
			// update_r['address'] = {'street':street, 'building':building, 'zipcode':zipcode, 'coord':[lon, lat]};

			// if (files.filetoupload.size > 0){
			// 	update_r['mimetype'] = mimetype;
			// 	update_r['photo'] = new Buffer(data).toString('base64');
			// }

			updateRestaurant(db, criteria, newValues, function(result){
        console.log("Update name = " + criteria._id);
				db.close();
        console.log(result);
        res.redirect('/list');
		    });
		  });
	  //});
   });

// 	var criteria = {};
// 	//criteria['_id'] = ObjectId(req.query._id);
// 	var newValues = {};
// 	var address = {};
//   var restaurantName = req.body.name;
//   var form = new formidable.IncomingForm();
// 	form.parse(req, function (err, fields){
//       console.log(fields._id);
//       criteria['_id'] = ObjectId(fields._id);
// 	MongoClient.connect(mongourl,function(err,db) {
// 		// var parsedURL = url.parse(req.url,true); //true to get query as object
// 		// var queryAsObject = parsedURL.query;
// 	assert.equal(err,null);
//   newValues['name'] = req.body.name;
// 	console.log('Connected to MongoDB\n');
// 	console.log("Start to update");
// 	console.log(criteria);
// 	console.log(newValues);
// 	updateRestaurant(db,criteria,newValues,function(result) {
// 	// for (key in queryAsObject) {
// 	// 	if (key == "_id") {
// 	// 		continue;
// 	// 	}
// 	// 	console.log("found id");
// 	// switch(key) {
// 	// 	case 'name':
// 	// 		name[key] = queryAsObject[key];
// 	// 	// case 'building':
// 	// 	// case 'street':
// 	// 	// case 'zipcode':
// 	// 	// 	address[key] = queryAsObject[key];
// 	// 		break;
// 	// 	default:
// 	// 		newValues[key] = queryAsObject[key];
// });
//
// 	console.log("var changed");
//
// // if (address.lenght > 0) {
// // 	newValues['address'] = address;
// // }
// console.log('Preparing update: ' + JSON.stringify(newValues));
// // updateRestaurant(db,criteria,newValues,function(result) {
// 	db.close();
// 	res.writeHead(200, {"Content-Type": "text/plain"});
// 	res.end("update was successful!");
// //});
// });
// });
//});

app.get('/api/restaurant/read/name/:rname',function(req,res){
  var criteria = {};
  criteria['name'] = req.params.rname;
  MongoClient.connect(mongourl, function(err, db) {
    assert.equal(err,null);
    console.log('Connected to MongoDB\n');
    db.collection('restaurantNew').findOne(criteria, function(err, result) {
    if(result == null){
      res.status(200).json({}).end();
    }else {
      console.log(result);
      res.status(200).json(result).end();
    }
    });
    db.close();
  });
});

app.get('/api/restaurant/read/borough/:borough',function(req,res){
  var criteria = {};
  criteria['borough'] = req.params.borough;
  MongoClient.connect(mongourl, function(err, db) {
    assert.equal(err,null);
    console.log('Connected to MongoDB\n');
    showBorough(db, criteria, function(restaurant){
      res.render("searchResult.ejs",{restaurant:restaurant});
    db.close();
  });
  });
});

app.get('/api/restaurant/read/cuisine/:cuisine',function(req,res){
  var criteria = {};
  criteria['cuisine'] = req.params.cuisine;
  MongoClient.connect(mongourl, function(err, db) {
    assert.equal(err,null);
    console.log('Connected to MongoDB\n');
    showCuisine(db, criteria, function(restaurant){
      res.render("searchResult.ejs",{restaurant:restaurant});
    db.close();
  });
  });
});

function create(db, detail, callback){
	db.collection('restaurantNew').insert(detail, function(){
		// assert.equal(null, err);
		console.log("Create a restaurant");
		callback();
	});
}

function showCuisine(db, c,callback){
  var restaurant = [];
  cursor = db.collection('restaurantNew').find(c);
  cursor.each(function(err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurant.push(doc);
		} else {
			console.log("find restaurant done");
			callback(restaurant);
		}
  });
}

function showBorough(db, c,callback){
  var restaurant = [];
  cursor = db.collection('restaurantNew').find(c);
  cursor.each(function(err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurant.push(doc);
		} else {
			console.log("find restaurant done");
			callback(restaurant);
		}
  });
}

function showDetail(db, c,callback){
  var restaurant = [];
  cursor = db.collection('restaurantNew').find({_id:c});
  cursor.each(function(err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurant.push(doc);
		} else {
			console.log("find restaurant done");
			callback(restaurant);
		}
  });
}



function updateRestaurant(db,criteria,n,callback) {
	console.log(n);
	console.log(criteria);
	db.collection('restaurantNew').update(criteria, {$set:n},function(err,result) {
      //console.log(result);
      console.log(n);
      console.log(criteria);
			assert.equal(err,null);
			console.log("update was successfully");
			callback(result);
	});
}

function insertMember(db, member,callback){
	db.collection('member').insertOne(member,function(err,result) {
    assert.equal(err, null);
    console.log("Inserted a member into the member collection.");
    callback(result);
  });
}

function findMember(db, u, callback) {
  var members = [];
  cursor = db.collection('member').find({name:u.name});
	// console.log(cursor)
	cursor.each(function(err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			members.push(doc);

		} else {
			console.log("find member done");
			callback(members);
		}
	});
	// console.log(cursor);
  // // cursor(function(err, doc) {
  // assert.equal(err, null);
  // if (u.name == cursor.name && u.password == cursor.password) {
  //     members.push(doc);
  //     console.log("Found");
  //   }
  // 		callback(members);
    // });
}

function findRestaurants(db,criteria,callback) {
	var restaurants = [];
		cursor = db.collection('restaurantNew').find(criteria);
	cursor.each(function(err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurants.push(doc);
		} else {
			callback(restaurants);
		}
	});
}

app.listen(process.env.PORT || 8099);
