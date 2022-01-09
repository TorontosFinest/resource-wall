// load .env data into process.env
require("dotenv").config();

// Web server config
const PORT = process.env.PORT || 8080;
const sassMiddleware = require("./lib/sass-middleware");
const express = require("express");
const app = express();
const morgan = require("morgan");

// PG database client/connection setup
const { Pool } = require("pg");
const dbParams = require("./lib/db.js");
const db = new Pool(dbParams);
db.connect();

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan("dev"));

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.use(
  "/styles",
  sassMiddleware({
    source: __dirname + "/styles",
    destination: __dirname + "/public/styles",
    isSass: false, // false => scss, true => sass
  })
);

app.use(express.static("public"));

// Separated Routes for each Resource
// Note: Feel free to replace the example routes below with your own
const usersRoutes = require("./routes/users");
const registerRoutes = require("./routes/register");
const userResourcesRoutes = require("./routes/user_resources");
const widgetsRoutes = require("./routes/widgets");
const register = require("./routes/register");

// Mount all resource routes
// Note: Feel free to replace the example routes below with your own
app.use("/api/users", usersRoutes(db));
app.use("/api/register", registerRoutes(db));
app.use("/api/widgets", widgetsRoutes(db));
// Note: mount other resources here, using the same pattern above

// Home page
// Warning: avoid creating more routes in this file!
// Separate them into separate routes files (see above).

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

const getUserWithEmail = function (email) {
  return db
    .query("SELECT * FROM users WHERE email = $1", [email])
    .then((result) => result.rows[0])
    .catch((err) => {
      console.log(err.message);
    });
};

const getUserWithUsername = function (username) {
  return db
    .query("SELECT * FROM users WHERE username = $1", [username])
    .then((result) => result.rows[0])
    .catch((err) => {
      console.log(err.message);
    });
};

const addUser = function (user) {
  return db
    .query(
      `INSERT INTO users (first_name,last_name,username,email,password)
   VALUES ($1, $2, $3, $4, $5) RETURNING id,first_name,last_name,username,email;`,
      [
        user["first_name"],
        user["last_name"],
        user["username"],
        user["email"],
        user["password"],
      ]
    )
    .then((result) => console.log(result.rows[0]))
    .catch((err) => {
      console.log(err.message);
    });
};

const login = function (email, password) {
  return getUserWithEmail(email).then((user) => {
    if (password === user.password) {
      return user;
    }
    return null;
  });
};

app.post("/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  login(email, password).then((user) => {
    if (!user) {
      res.redirect("/login");
      console.log(user.data[0]);
    } else {
      res.redirect("/");
    }
  });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const user = req.body;
  console.log(req.body);
  if (getUserWithEmail(user.email) || getUserWithUsername(user.username)) {
    console.log("user already in system");
    res.redirect("/login");
  } else {
    addUser(user).then(() => res.redirect("/"));
  }
});

app.get("/user/:id", (req, res) => {
  res.render("user_resources");
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
