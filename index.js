require("./logging"); // Start logging before anything else!
const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
var serveIndex = require("serve-index");
const { extractCrashReports } = require("./ue4CrashExtractor");

const PORT = process.env.PORT || 8080;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const REPORTS_DIR = process.env.REPORTS_DIR || "./reports";
const UPLOAD_PDB_DIR = process.env.UPLOAD_PDB_DIR || "./uploadsPDB";
const DATABASE_DIR = process.env.DATABASE_DIR || "./db";

const multer = require("multer");
const upload = multer({ dest: UPLOAD_PDB_DIR });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);
if (!fs.existsSync(UPLOAD_PDB_DIR)) fs.mkdirSync(UPLOAD_PDB_DIR);
if (!fs.existsSync(DATABASE_DIR)) fs.mkdirSync(DATABASE_DIR);

app.listen(PORT, () => {
  console.log("(+) Crash Report System started.");
  extractCrashReports(); // Run extraction now
  processCrashReports(); // Run processing now
});

app.get("/", (req, res) => {
  res.status(200).send("CRS ready.");
});

var immediateSched = false; // Makes sure immediate scheduling doesn't get repetitive for quick consecutive requests

//////// RECEIVING

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
                processCrashReports(); // Schedule processing
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

app.post(
  "/upload-QA-PDB",
  upload.array("upload[]", 1),
  async (req, res, next) => {
    if (req.files.length) {
      const pdb = req.files[0];
      fs.rename(
        `${pdb.destination}/${pdb.filename}`,
        `${pdb.destination}/${req.body.PDBHash}.zip`,
        (err) => {
          if (err) {
            res.status(500).send("PDB Upload failed.");
            console.log("ERROR: " + err);
            return;
          }
          res.status(200).send("PDB upload successful.");
          console.log(`(✔) Received PDB from QA for '${req.body.crashGUID}'`);
          // Store (CrashGUID,PDBHash) pair in simplePDBDB.txt
          fs.appendFile(
            `${DATABASE_DIR}/simplePDBDB.txt`,
            `\n${req.body.crashGUID},${req.body.PDBHash}.zip`,
            (err) => {
              if (err) {
                console.log("ERROR: " + err);
                return;
              }
              console.log("(✔) PDB DB updated.");
              setTimeout(() => {
                processCrashReports(); // Schedule processing
              }, 3000);
            }
          );
        }
      );
    } else {
      // No file was sent, this means MiddleMan knows that we already have the PDB with exact hash
      fs.appendFile(
        `${DATABASE_DIR}/simplePDBDB.txt`,
        `\n${req.body.crashGUID},${req.body.PDBHash}.zip`,
        (err) => {
          if (err) {
            res.status(500).send("PDB Upload failed.");
            console.log("ERROR: " + err);
            return;
          }
          res.status(200).send("PDB upload successful.");
          console.log("(✔) PDB DB updated.");
          setTimeout(() => {
            processCrashReports(); // Schedule processing
          }, 3000);
        }
      );
    }
  }
);

app.get("/check-PDB-Hash", (req, res) => {
  let checkFileExists = (s) =>
    new Promise((r) => fs.access(s, fs.constants.F_OK, (e) => r(!e)));
  checkFileExists(`${UPLOAD_PDB_DIR}/${req.query.PDBHash}.zip`).then(
    (exists) => {
      if (exists) res.send("1");
      else res.send("0");
    }
  );
});

//////// PRESENTATION

// Serve extracted reports as an index for now
app.use("/reports", serveIndex(REPORTS_DIR));
app.use("/reports", express.static(REPORTS_DIR));
// Serve PDBs
app.use("/uploadsPDB", express.static(UPLOAD_PDB_DIR));

app.get("/summary", async (req, res) => {
  fs.readFile(
    `${DATABASE_DIR}/simpleCrashDB.json`,
    "utf8",
    async (err, data) => {
      if (err)
      {
        res.status(500).send("Something went wrong.\nPlease refresh this page in a few mins.");
        processCrashReports();
        return;
      }
      var htmlGen = "";
      const simpleCrashDB = JSON.parse(data);
      simpleCrashDB.forEach((report) => {
        htmlGen += `<tr>
      <td>${report.crashGUID}</td>
      <td>${report.crcVersion}</td>
      <td>${report.buildConfig}</td>
      <td>${report.engineVersion}</td>
      <td>${report.crashType}</td>
      <td>${report.errorMsg}
        <details>
          <summary>Call Stack<span class="icon">▼</span></summary>
          <p>${report.callStack}</p>
        </details>
      </td>
      <td><a class="styled-btn" href="../reports/${report.crashReportDir}" target="_blank">${report.crashReportDir}</a></td>
      <td>${report.crashPDB.description},<br><br><a class="styled-btn" href="${report.crashPDB.url}">${report.crashPDB.source}</a></td>
      </tr>`;
      });
      fs.readFile("html/summary.html", "utf8", async (err, data) => {
        const html = data.replace("{HTML_GEN}", htmlGen);
        res.send(html);
      });
    }
  );
});

// setInterval(() => {
//   processCrashReports(); // Periodical processing
// }, 1000 * 60 * 10); // Every 10 mins

const processCrashReports = () => {
  // https://stackoverflow.com/a/53721345
  const exec = require("child_process").exec;
  exec("node reportProcessor.js", (err, stdout, stderr) => {
    process.stdout.write(`${stdout}`);
    // process.stdout.write(`${stderr}`);
    if (err !== null) {
      console.log(`exec error: ${err}`);
    }
  });
};

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
