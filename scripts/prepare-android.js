// Creates/updates the Android project: adds camera + GPS permissions and the LinisLoop launcher icon.
const { execSync } = require("child_process"), fs = require("fs"), path = require("path");
const run = c => execSync(c, { stdio: "inherit" });
if (!fs.existsSync("android")) run("npx cap add android");
run("npx cap sync android");

const mf = "android/app/src/main/AndroidManifest.xml";
let x = fs.readFileSync(mf, "utf8");
for (const p of ["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"])
  if (!x.includes("android.permission." + p)) x = x.replace("</manifest>", `    <uses-permission android:name="android.permission.${p}" />\n</manifest>`);
if (!x.includes("hardware.camera")) x = x.replace("</manifest>", '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
fs.writeFileSync(mf, x);

const res = "android/app/src/main/res", icon = "www/assets/icon-512.png";
for (const d of fs.readdirSync(res).filter(d => d.startsWith("mipmap-"))) {
  const dir = path.join(res, d);
  if (d.includes("anydpi")) { fs.rmSync(dir, { recursive: true, force: true }); continue; }
  fs.rmSync(path.join(dir, "ic_launcher_foreground.png"), { force: true });
  for (const n of ["ic_launcher.png", "ic_launcher_round.png"]) fs.copyFileSync(icon, path.join(dir, n));
}
console.log("\nAndroid project ready. Build: cd android && ./gradlew assembleDebug");
