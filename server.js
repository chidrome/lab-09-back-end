'use strict';

require('dotenv').config();
const superagent = require('superagent');
const pg = require('pg');
const cors = require('cors');
const express = require('express');
const app = express();
app.use(cors());


const PORT = process.env.PORT || 8000;
const weatherArr = [];

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

// Constructor Functions
const Location = function(obj){
  this.search_query = obj.results[0].address_components[0].long_name;
  this.formatted_query = obj.results[0].formatted_address;
  this.latitude = obj.results[0].geometry.location.lat;
  this.longitude = obj.results[0].geometry.location.lng;
};

const Weather = function(obj) {
  this.forecast = obj.summary;
  this.time = new Date(obj.time * 1000).toString().slice(0, 15);
  weatherArr.push(this);
};

const Events = function(link, name, eventDate, summary){
  this.link = link;
  this.name = name;
  this.event_date = eventDate;
  this.summary = summary;
};

const Movie = function(title, overview, average_votes, total_votes, image_url, popularity, released){
  this.title = title;
  this.overview = overview;
  this.average_votes = average_votes;
  this.total_votes = total_votes;
  this.image_url = image_url;
  this.popularity = popularity;
  this.released_on = released;
};

const Yelp = function(name, image_url, price, rating, url){
  this.name = name;
  this.image_url = image_url;
  this.price = price;
  this.rating = rating;
  this.url = url;
};

app.get('/', (req, res) => {
  res.send('THIS IS THE HOME STUB!');
});

// Location Endpoint
app.get('/location', (request, response) => {
  try {
    let queryData = request.query.queryData.toLowerCase();
    let sqlQueryDataCheck = `SELECT * FROM location WHERE search_query = $1;`;
    let values = [queryData];

    client.query(sqlQueryDataCheck, values)
      .then((data) => {
        if(data.rowCount > 0){
          response.send(data.rows[0]);
        } else {
          let locUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${queryData}&key=${process.env.GEOCODE_API_KEY}`;
          superagent.get(locUrl)
            .then(result=> {
              let loc = new Location(result.body);
              let insertStatement = `INSERT INTO location (latitude, longitude, formatted_query, search_query, date_created) VALUES ($1, $2, $3, $4, $5);`;
              let values = [loc.latitude, loc.longitude, loc.formatted_query, loc.search_query.toLowerCase(), Date.now()];
              client.query(insertStatement, values);
              response.send(loc);
            })
            .catch((error)=> {
              console.log('THERE\'S BEEN AN ERROR WITH SUPERAGENT', error);
            });
        }
      })
      .catch((error)=> {
        console.log('OH NO THERE\'S BEEN AN ERRORRRRRRRRR Querying data from the database.', error);
      });
  } catch(e) {
    response.status(500).send('Sorry something went wrong with location!');
    console.log(e);
  }
});

// Weather Endpoint
app.get('/weather', (request, response) => {
  try {
    checkDB(request, response, 'weather');
  } catch(e) {
    response.status(500).send('Sorry something went wrong with weather!');
  }
});

// Events Endpoint
app.get('/events', (request, response) => {
  try {
    checkDB(request, response, 'events');
  } catch(e) {
    response.status(500).send('Sorry something went wrong with events!',e);
  }
});

// movies route
app.get('/movies', (request, response) => {
  try {
    checkDB(request, response, 'movies');
  }
  catch(e) {
    response.status(500).send('Sorry something went wrong with movies!',e);
  }
});

app.get('/yelp', (request, response) => {
  try {
    checkDB(request, response, 'yelp');
  }
  catch(e) {
    response.status(500).send('Sorry something went wrong with yelp!',e);
  }
});

// Console logs PORT when server is listening
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));


// Helper function to check whether or not search query is already cached.
const checkDB = (request, response, tableName) => {
  let sqlQueryCheck = `SELECT * FROM ${tableName} WHERE search_query = $1;`;
  let values = [request.query.queryData];


  client.query(sqlQueryCheck, values)
    .then((data) => {
      if(data.rowCount > 0){
        if(checkTimeout(tableName, data.rows[0].date_created, timeouts)){
          console.log('about to delete your shit.');
          deleteRecord(tableName, request.query.queryData);
          if(tableName === 'weather'){
            return weatherAPICall(request, response);
          } else if(tableName === 'events'){
            return eventsAPICall(request, response);
          } else if(tableName === 'movies'){
            return movieAPICall(request, response);
          } else if(tableName === 'yelp'){
            return yelpAPICall(request, response);
          }
        }
      } else if(tableName === 'weather'){
        return weatherAPICall(request, response);
      } else if(tableName === 'events'){
        return eventsAPICall(request, response);
      } else if(tableName === 'movies'){
        return movieAPICall(request, response);
      } else if(tableName === 'yelp'){
        return yelpAPICall(request, response);
      }
    })
    .catch((error)=> {
      console.log(error);
    });
};

// Helper function to make API call and cache Weather Data of unknown search queries.
const weatherAPICall = (request, response) => {
  let weaUrl = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.lat},${request.query.long}`;
  superagent.get(weaUrl)
    .then(result => {
      let newWeatherArr = result.body.daily.data.map(element => {
        return new Weather(element);
      });
      newWeatherArr.forEach((item)=> {
        let insertStatement = `INSERT INTO weather (forecast, time, search_query, date_created) VALUES ($1, $2, $3, $4);`;
        let values = [item.forecast, item.time, request.query.queryData, Date.now()];
        client.query(insertStatement, values);
      });
      response.send(newWeatherArr);
    });
};

// Helper function to make API call and cache Event Data of unknown search queries.
const eventsAPICall = (request, response) => {
  let eventURL = `https://www.eventbriteapi.com/v3/events/search?location.longitude=${request.query.long}&location.latitude=${request.query.lat}&token=${process.env.EVENTBRITE_API_KEY}`;
  superagent.get(eventURL)
    .then(result => {
      let eventsArray = result.body.events.map((element) => {
        return new Events(element.url, element.name.text, element.start.local, element.description.text);
      });
      eventsArray.forEach((item) => {
        let insertStatement = `INSERT INTO events (link, name, event_date, summary, search_query, date_created) VALUES ($1, $2, $3, $4, $5, $6);`;
        let values = [item.link, item.name, item.event_date, item.summary, request.query.queryData, Date.now()];
        client.query(insertStatement, values);
      });
      response.send(eventsArray);
    });
};


// function to call movie api
const movieAPICall = (request, response) => {
  let movieURL = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.MOVIE_API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1`;
  superagent.get(movieURL)
    .then(result => {
      let moviesArray = result.body.results.map((element) => {
        return new Movie(element.title, element.overview, element.vote_average, element.vote_count, element.poster_path, element.popularity, element.release_date);
      });
      moviesArray.forEach((item) => {
        let insertStatement = `INSERT INTO movies (title, overview, average_votes, total_votes, image_url, popularity, released_on, search_query, date_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
        let values = [item.title, item.overview, item.average_votes, item.total_votes, `https://image.tmdb.org/t/p/w200${item.image_url}`, item.popularity, item.released_on, request.query.queryData, Date.now()];
        client.query(insertStatement, values);
      });
      response.send(moviesArray);
    });
};

// yelp call
const yelpAPICall = (request, response) => {
  let yelpURL = `https://api.yelp.com/v3/businesses/search?location=${request.query.queryData}`;
  superagent.get(yelpURL)
    .set(`Authorization`, `Bearer ${process.env.YELP_API_KEY}`)
    .then((data) => {
      let businessesArray = data.body.businesses.map((element) => {
        return new Yelp(element.name, element.image_url, element.price, element.rating, element.url);
      });
      businessesArray.forEach((item) => {
        let insertStatement = `INSERT INTO yelp (name, image_url, price, rating, url, search_query, date_created) VALUES ($1, $2, $3, $4, $5, $6, $7);`;
        let values = [item.name, item.image_url, item.price, item.rating, item.url, item.search_query, Date.now()];
        client.query(insertStatement, values);
      });
      response.send(businessesArray);
    });
};

//Cache Invalidation
const timeouts = {
  //15 secs
  weather: 15 * 1000,
  //24 hours
  location: 24 * 60 * 60 * 1000,
  event: 24 * 60 * 60 * 1000,
  movie: 30 * 24 * 60 * 60 * 1000,
  yelp: 2 * 24 * 60 * 60 * 1000,
};

const deleteRecord = (table, query_param) => {
  let sql = `DELETE FROM ${table} WHERE search_query = $1;`;
  let values = [query_param];
  client.query(sql, values);
};

//Check timeout
const checkTimeout = (tableName, sqlData) => {
  return (Date.now() - sqlData) > timeouts[tableName];
};


