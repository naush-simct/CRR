// Inspired from: https://stackoverflow.com/a/24634454

const MongoClient = require("mongodb").MongoClient;
const url = "mongodb://mongodb:27017"; // HostName: mongodb

const client = new MongoClient(url, { useUnifiedTopology: true });
const db = client.db("CRS-DB"); // Database: CRS-DB
client.connect((err) => {
  if (err) {
    console.log(`(✖) Connecting to MongoDB failed.`, "\n", err);
    throw err;
  }
  console.log("(+) MongoDB connection established.");
});

module.exports = {
  client: client,
  db: db,
};
