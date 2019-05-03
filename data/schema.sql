DROP TABLE IF EXISTS location, weather, events, movies, yelp;

CREATE TABLE location (
  id SERIAL,
  latitude DECIMAL,
  longitude DECIMAL,
  formatted_query TEXT,
  search_query TEXT,
  date_created BIGINT
);

CREATE TABLE weather (
  id SERIAL,
  forecast TEXT,
  time TEXT,
  search_query TEXT,
  date_created BIGINT
);

CREATE TABLE events (
  id SERIAL,
  link TEXT,
  name TEXT,
  event_date TEXT,
  summary TEXT,
  search_query TEXT,
  date_created BIGINT
);

CREATE TABLE movies (
  id SERIAL,
  title TEXT,
  overview TEXT,
  average_votes DECIMAL,
  total_votes INTEGER,
  image_url TEXT,
  popularity DECIMAL,
  released_on TEXT,
  search_query TEXT,
  date_created BIGINT
);

CREATE TABLE yelp (
  id SERIAL, 
  name TEXT,
  image_url TEXT,
  price TEXT,
  rating DECIMAL,
  url TEXT,
  search_query TEXT,
  date_created BIGINT
);