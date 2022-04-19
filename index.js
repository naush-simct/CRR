const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
var serveIndex = require("serve-index");
const { extractCrashReports } = require("./ue4CrashExtractor");

const PORT = process.env.PORT || 8080;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads"; // TODO: Add environment var for dir, port
const REPORTS_DIR = process.env.REPORTS_DIR || "./reports";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);

app.get("/", (req, res) => {
  res.status(200).send("CRR ready.");
});

var immediateSched = false; // Makes sure immediate scheduling doesn't get repetitive for quick consecutive requests

app.post("/upload", async (req, res) => {
  const buffers = [];
  for await (const chunk of req) {
    buffers.push(chunk);
  }
  const fileData = Buffer.concat(buffers);
  const uniqueDTID = getDateTimeString();
  fs.writeFile(
    `${UPLOAD_DIR}/${uniqueDTID}.ue4crash`,
    fileData,
    async (err) => {
      if (err) {
        console.log(`(✖) Writing ${uniqueDTID}.ue4crash failed.`, "\n", err);
        res.status(409).send("Report uploading failed."); // https://stackoverflow.com/a/7088468
        return;
      }

      fs.writeFile(
        `${UPLOAD_DIR}/${uniqueDTID}.json`,
        JSON.stringify(req.query, null, "\t"),
        async (err) => {
          if (err) {
            console.log(`(✖) Writing ${uniqueDTID}.json failed.`, "\n", err);
            res.status(409).send("Report uploading failed."); // https://stackoverflow.com/a/7088468
          } else {
            console.log("(✔) Received a crash file.");
            res.status(201).send("Report uploaded.");

            if (!immediateSched) {
              setTimeout(() => {
                extractCrashReports(); // Schedule extraction
                immediateSched = false;
              }, 3000);
              immediateSched = true;
            }
          }
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log("(+) Crash Report Receiver started.");
  extractCrashReports(); // Run extraction now
});

// Serve extracted reports as an index for now
app.use("/reports", serveIndex(REPORTS_DIR));
app.use("/reports", express.static(REPORTS_DIR));

app.get("/summary", async (req, res) => {
  fs.readFile("simpleCrashDB.json", "utf8", async (err, data) => {
    var htmlGen = "";
    const simpleCrashDB = JSON.parse(data);
    simpleCrashDB.forEach((report) => {
      htmlGen += `<tr>
      <td>${report.crashID}</td>
      <td>${report.crcVersion}</td>
      <td>${report.buildConfig}</td>
      <td>${report.engineVersion}</td>
      <td>${report.crashType}</td>
      <td>${report.errorMsg}</td>
      <td><a href="../reports/${report.crashReportDir}" target="_blank">${report.crashReportDir}</a></td>
      <td><a>pending</a></td>
      </tr>`;
    });
    fs.readFile("html/summary.html", "utf8", async (err, data) => {
      const html = data.replace("{HTML_GEN}", htmlGen);
      res.send(html);
    });
  });
});

setInterval(() => {
  extractCrashReports(); // Periodical extraction
}, 1000 * 60 * 10); // Every 10 mins

setInterval(() => {
  // https://stackoverflow.com/a/53721345
  const exec = require("child_process").exec;
  exec("node reportProcessor.js", (err, stdout, stderr) => {
    process.stdout.write(`${stdout}`);
    // process.stdout.write(`${stderr}`);
    if (err !== null) {
      console.log(`exec error: ${err}`);
    }
  });
}, 1000 * 60 * 30); // Every 30 mins

const getDateTimeString = () => {
  // https://stackoverflow.com/a/30272803
  // e.g. 2022_08_29_10_09_32
  var d = new Date();
  var dateTime =
    d.getFullYear() +
    "_" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "_" +
    ("0" + d.getDate()).slice(-2) +
    "_" +
    ("0" + d.getHours()).slice(-2) +
    "_" +
    ("0" + d.getMinutes()).slice(-2) +
    "_" +
    crypto.randomBytes(20).toString("hex").slice(-5);

  return dateTime;
};
