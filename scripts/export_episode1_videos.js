const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const Database = require("better-sqlite3");
const sharp = require("sharp");

const projectId = 1786178088306;
const appRoot = path.resolve(__dirname, "..");
const outputRoot = "D:\\DATA\\WeMedia\\AIShortPlay\\aishort-play-data\\剧本\\剧本1\\生成资产\\第1集动态视频";

/** 生成单条视频的逐秒接触表，供动作、身份与穿模质检。 */
function makeContactSheet(source, target) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", source, "-vf", "fps=1,scale=270:480,tile=6x1", "-frames:v", "1", target]);
}

/** 将若干接触表组成带镜号标签的质检页。 */
async function makeQaPage(items, target) {
  const rowWidth = 960;
  const rowHeight = 316;
  const canvas = sharp({ create: { width: rowWidth, height: rowHeight * items.length, channels: 3, background: "#111111" } });
  const composites = [];
  for (let index = 0; index < items.length; index += 1) {
    const image = await sharp(items[index].sheet).resize(rowWidth, 284, { fit: "fill" }).jpeg().toBuffer();
    const label = Buffer.from(`<svg width="${rowWidth}" height="32"><rect width="100%" height="100%" fill="#111"/><text x="16" y="23" fill="white" font-size="20" font-family="Arial">${items[index].unit}</text></svg>`);
    composites.push({ input: label, left: 0, top: index * rowHeight });
    composites.push({ input: image, left: 0, top: index * rowHeight + 32 });
  }
  await canvas.composite(composites).jpeg({ quality: 90 }).toFile(target);
}

/** 导出每个镜头最新的成功版本，失败重试记录不会覆盖有效结果。 */
async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const db = new Database(path.join(appRoot, "data", "db2.sqlite"), { readonly: true });
  const tracks = db.prepare("select id from o_videoTrack where projectId=? order by id").all(projectId);
  const exported = [];
  for (const track of tracks) {
    const board = db.prepare("select track from o_storyboard where trackId=? order by id limit 1").get(track.id);
    const video = db.prepare("select id,filePath from o_video where videoTrackId=? and state='生成成功' order by id desc limit 1").get(track.id);
    if (!board || !video) continue;
    const source = path.join(appRoot, "data", "oss", video.filePath.replace(/^\//, ""));
    const videoTarget = path.join(outputRoot, `${board.track}_source_6s_v001.mp4`);
    const sheetTarget = path.join(outputRoot, `${board.track}_contact_v001.jpg`);
    fs.copyFileSync(source, videoTarget);
    makeContactSheet(source, sheetTarget);
    exported.push({ unit: board.track, video: videoTarget, sheet: sheetTarget, videoId: video.id });
  }
  db.close();

  const midpoint = Math.ceil(exported.length / 2);
  await makeQaPage(exported.slice(0, midpoint), path.join(outputRoot, "第1集动态质检接触表_A_v001.jpg"));
  await makeQaPage(exported.slice(midpoint), path.join(outputRoot, "第1集动态质检接触表_B_v001.jpg"));
  console.log(JSON.stringify(exported, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
