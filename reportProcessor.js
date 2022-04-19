const fs = require("fs");

const REPORTS_DIR = process.env.REPORTS_DIR || "./reports";

console.log(`(!) Starting report processing...`);

const crashReportDirs = fs
  .readdirSync(REPORTS_DIR, { withFileTypes: true })
  .filter((crashReportDir) => crashReportDir.isDirectory())
  .map((crashReportDir) => crashReportDir.name);

if (!crashReportDirs.length) console.log(`(!) Nothing left to process.`);

simpleCrashDB = [];

crashReportDirs.forEach((crashReportDir) => {
  // Store necessary information in database.
  // Crash date, Crash ID, Crash version, UE Version, Crash ZIP file name
  const contextXML = fs.readFileSync(
    `${REPORTS_DIR}/${crashReportDir}/CrashContext.runtime-xml`
  );
  const convert = require("xml-js");
  const contextJSON = convert.xml2json(contextXML, { compact: true });
  const context = JSON.parse(contextJSON).FGenericCrashContext;
  const crashMetadata = {
    crashID: context.RuntimeProperties.CrashGUID._text,
    crcVersion: context.RuntimeProperties.CrashReportClientVersion._text,
    buildConfig: context.RuntimeProperties.BuildConfiguration._text,
    engineVersion: context.RuntimeProperties.EngineVersion._text,
    crashType: context.RuntimeProperties.CrashType._text,
    errorMsg: context.RuntimeProperties.ErrorMessage._text,
    crashReportDir: `${crashReportDir}`,
  };
  simpleCrashDB.push(crashMetadata);
});
// console.log(simpleCrashDB);
// https://stackoverflow.com/a/56904201
fs.writeFileSync("simpleCrashDB.json", JSON.stringify(simpleCrashDB));

console.log("(✔) Report processing complete.");
