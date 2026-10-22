const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const projectId = 1786178088306;
const scriptId = 1786178088307;
const appRoot = path.resolve(__dirname, "..");
const voiceRoot = "D:\\DATA\\WeMedia\\AIShortPlay\\aishort-play-data\\剧本\\剧本1\\生成资产\\第1集声音\\MiniMax正式配音_v001";
const mixPath = "D:\\DATA\\WeMedia\\AIShortPlay\\aishort-play-data\\剧本\\剧本1\\生成资产\\第1集声音\\第1集正式混音_MiniMax_v001.mp3";
const parentName = "第1集 MiniMax 正式配音与混音";

/** 将一个声音文件复制到 Toonflow 项目的素材目录，并返回数据库使用的相对路径。 */
function copyAudioToProject(sourcePath, targetName) {
  const relativePath = `/${projectId}/assets/audio/${targetName}`;
  const targetPath = path.join(appRoot, "data", "oss", relativePath.replace(/^\//, ""));
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return relativePath;
}

/** 导入第1集的逐句正式配音和最终混音；若父素材已存在则安全跳过。 */
function main() {
  const manifestPath = path.join(voiceRoot, "配音清单.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`缺少配音清单：${manifestPath}`);
  if (!fs.existsSync(mixPath)) throw new Error(`缺少正式混音：${mixPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const db = new Database(path.join(appRoot, "data", "db2.sqlite"));
  const existing = db.prepare("select id from o_assets where projectId=? and type='audio' and name=?").get(projectId, parentName);
  if (existing) {
    db.close();
    console.log(`SKIPPED_EXISTING_PARENT=${existing.id}`);
    return;
  }

  const maxAssetId = db.prepare("select coalesce(max(id),0) id from o_assets").get().id;
  const maxImageId = db.prepare("select coalesce(max(id),0) id from o_image").get().id;
  let nextAssetId = Math.max(Date.now(), maxAssetId + 1);
  let nextImageId = Math.max(Date.now() + 1000, maxImageId + 1);
  const parentId = nextAssetId++;
  const now = Date.now();

  const insertParent = db.prepare("insert into o_assets (id,name,type,describe,scriptId,projectId,startTime) values (?,?,?,?,?,?,?)");
  const insertChild = db.prepare("insert into o_assets (id,name,prompt,type,describe,scriptId,imageId,assetsId,projectId,startTime,promptState,audioBindState) values (?,?,?,?,?,?,?,?,?,?,?,?)");
  const insertMedia = db.prepare("insert into o_image (id,filePath,type,assetsId,model,state,errorReason) values (?,?,?,?,?,?,?)");

  const importAll = db.transaction(() => {
    insertParent.run(parentId, parentName, "audio", "MiniMax speech-2.8-turbo 正式对白14条，以及第1集正式混音；共207计费字符。", scriptId, projectId, now);

    // 保留逐句音频，后续可在 Toonflow 中单独试听或重新编排。
    for (const [index, item] of manifest.entries()) {
      const sourcePath = path.join(voiceRoot, item.file);
      if (!fs.existsSync(sourcePath)) throw new Error(`缺少配音文件：${sourcePath}`);
      const relativePath = copyAudioToProject(sourcePath, `episode1_minimax_${String(index + 1).padStart(2, "0")}.mp3`);
      const assetId = nextAssetId++;
      const imageId = nextImageId++;
      insertMedia.run(imageId, relativePath, "audio", assetId, "speech-2.8-turbo", "已完成", "");
      insertChild.run(assetId, `E01-VO-${String(index + 1).padStart(2, "0")} ${item.role}`, item.text, "audio", `voiceId=${item.voiceId}; timeline=${item.delayMs}ms; duration=${item.audioLengthMs}ms`, scriptId, imageId, parentId, projectId, now, "已完成", 0);
    }

    // 最终混音作为同组的最后一项，便于直接试听与导出。
    const mixRelativePath = copyAudioToProject(mixPath, "episode1_final_mix_minimax_v001.mp3");
    const mixAssetId = nextAssetId++;
    const mixImageId = nextImageId++;
    insertMedia.run(mixImageId, mixRelativePath, "audio", mixAssetId, "MiniMax+SFX mix", "已完成", "");
    insertChild.run(mixAssetId, "E01-MIX 正式混音", "第1集完整对白、环境声与动作音效混音", "audio", "65秒；立体声；48kHz母版另存于项目生成资产目录", scriptId, mixImageId, parentId, projectId, now, "已完成", 0);
  });

  importAll();
  db.close();
  console.log(`IMPORTED_PARENT=${parentId}`);
  console.log(`IMPORTED_CHILDREN=${manifest.length + 1}`);
}

main();
