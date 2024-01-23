CREATE DATABASE reedit;

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    upvotes INTEGER,
    title TEXT,
    image_url TEXT,
    description TEXT,
    username TEXT,
    subreedit TEXT
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT,
    email TEXT,
    password_digest TEXT
);

CREATE TABLE comments (
    post_id INTEGER,
    description TEXT,
    username TEXT
);