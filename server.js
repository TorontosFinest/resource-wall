// load .env data into process.env
require("dotenv").config();

// Web server config
const PORT = process.env.PORT || 8080;
const sassMiddleware = require("./lib/sass-middleware");
const express = require("express");
const app = express();
const cookieSession = require("cookie-session");
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
app.use(
  cookieSession({
    name: "SESH",
    keys: ["key1,", "key2"],
  })
);
app.use(express.static("public"));

// Separated Routes for each Resource
// Note: Feel free to replace the example routes below with your own
const loginRoutes = require("./routes/login");
const addResource = require("./routes/addResource");
const registerRoutes = require("./routes/register");
const searchRoutes = require("./routes/search");
const resourcesRoutes = require("./routes/resources");
const rateRoutes = require("./routes/rate");
const profileRoutes = require("./routes/profile");
const commentsPage = require("./routes/commentsPage");
const { query } = require("express");

// Mount all resource routes
// Note: Feel free to replace the example routes below with your own
app.use("/", registerRoutes(db));
app.use("/", addResource(db));
app.use("/", loginRoutes(db));
app.use("/", searchRoutes(db));
app.use("/", rateRoutes(db));
app.use("/", resourcesRoutes(db));
app.use("/", profileRoutes(db));
app.use("/", commentsPage(db));

// Note: mount other resources here, using the same pattern above

// Home page
// Warning: avoid creating more routes in this file!
// Separate them into separate routes files (see above).

app.get("/", (req, res) => {
  //query to get all information about the resource
  db.query(
    `SELECT resources.*, categories.name AS category_type, count(likes.*) AS like, avg(ratings.rating) AS rating
    FROM resources
    RIGHT JOIN categories_resources ON resources.id = resource_id
    LEFT JOIN categories ON categories.id = category_id
    LEFT JOIN likes ON likes.resource_id = resources.id
    LEFT JOIN ratings ON ratings.resource_id = resources.id
    GROUP BY resources.id, categories.name
    ORDER BY resources.created_at DESC`
  )
    .then((data) => {
      const resources = data.rows;
      const templateVars = { resources };
      res.render("index", templateVars);
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

// gets the resources made by a specific user
app.get("/user/:id", (req, res) => {
  res.render("user_resources");
});
// set session to null when logged out
app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

app.post("/likes", (req, res) => {
  // get the users id and the resources id
  const resourceID = req.body["resource_id "]; //dont delete the space
  const user = req.session.user_id;
  // if user is logged in , check if user has already liked the resource
  if (user) {
    db.query(`SELECT * FROM likes WHERE user_id = $1 AND resource_id = $2;`, [
      user,
      resourceID,
    ]).then((result) => {
      // if user hasnt liked the resource, insert a like into the database
      if (result.rows.length < 1) {
        return db
          .query(`INSERT INTO likes (user_id , resource_id) VALUES ($1, $2);`, [
            user,
            resourceID,
          ])
          .then(() => {
            return res.json({
              status: 201,
            });
          });
      } else {
        return res.json({
          "Error Message": "You have already liked this resource.",
          status: 429,
        });
      }
    });
  }
});
