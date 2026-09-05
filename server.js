const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve files from the main project folder
app.use(express.static(__dirname));

// Open Singh Kitchen website
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// GoDaddy health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(Singh Kitchen running on port ${PORT});
});
