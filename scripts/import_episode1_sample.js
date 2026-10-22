const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const appRoot = path.resolve(__dirname, "..");
const dbPath = path.join(appRoot, "data", "db2.sqlite");
const storyRoot = "D:\\DATA\\WeMedia\\AIShortPlay\\aishort-play-data\\剧本\\剧本1";
const generatedRoot = path.join(storyRoot, "生成资产");
const projectName = "这座城，给我一张桌子｜第1集样片";

const units = [
  ["E01-G01", 5, "陈野静止在人流中，从手机缓慢抬头，目光转向画面右上方；路人只在前景横向经过。镜头稳定缓慢推进，人物、背包、左手行李箱和右手手机保持连续，不换脸、不换手、不绕拍。"],
  ["E01-G02", 4, "陈野右手结束电话，拇指离开屏幕；看见余额后下颌轻微收紧，其余动作保持静止。摄影机固定，只把焦点从手机平滑转到右侧脸，手机外形与手指数量保持稳定。"],
  ["E01-G03", 5, "陈野推开玻璃门，向室内走两步后停住；前台人员只把一块无字亚克力块放进纸箱。镜头从背后平稳跟入并随人物停止，人物不穿门、不瞬移，空间轴线不变。"],
  ["E01-G04", 4, "陈野点击拨号，电话立即结束；手指缓慢收紧，视线从屏幕变得短暂失焦。镜头固定，只做手机到眼睛的平滑拉焦，禁止生成文字、弯曲手机或改变手指。"],
  ["E01-G05", 5, "陈野在雨棚下听完电话，放下手机后重新拨号，最后低头查看电量；行李始终停在左手旁。镜头隔着雨玻璃固定观察，只保留轻微手持感，雨量和衣服湿度连续。"],
  ["E01-G06", 4, "陈野右拇指在聊天输入区短暂停住，随后连续删除并把手机翻扣在掌心；头略低，背部仍挺直。摄影机固定，手机不掉落，手指与屏幕结构不变。"],
  ["E01-G07", 4, "旧打印机缓慢吐出一张带黑线的废纸；客户只拍柜台一次，何叔随后弯腰查看操作屏。摄影机稳定轻推向出纸托盘，禁止爆炸、浓烟、火花和多人重复动作。"],
  ["E01-G08", 4, "陈野视线从废纸黑线移到进纸口，放下背包并向机器迈近半步，右手只指向电源插头。摄影机静止，动作克制，背包落点固定，不拆机、不凭空出现工具。"],
  ["E01-G09", 5, "陈野先确认电源插头已拔出，再打开打印机左侧维修盖，用小刷缓慢清理传感器旁的纸屑。摄影机固定拍手部，动作严格按顺序完成，工具、插头和盖板位置连续。"],
  ["E01-G10", 4, "旧打印机平稳送出一张干净白纸，纸张沿托盘直线前进并停止。镜头从出纸口轻微后拉，纸张不飞出、不扭曲，机器不抖动，画面不生成任何文字或图案。"],
  ["E01-G11", 4, "何叔递出两张纸币，陈野只抽走最上面一张，再把其余轻推回何叔掌心。镜头从手部缓慢抬到两人表情，钱不掉落，双手不融合，人物不拥抱。"],
  ["E01-G12", 5, "何叔看向门边行李，走一步推开储物间门并按亮暖黄灯；陈野向门内迈半步后停住。镜头沿柜台缓慢侧移揭示折叠床，何叔始终在左、陈野始终在右。"],
  ["E01-G13", 6, "赵成推门进入，在门垫上收好黑伞并放稳，走到柜台，把一份无字文件摆正后平推给何叔。镜头稳定轻微横移，赵成始终在柜台外，雨伞和文件不消失。"],
  ["E01-G14", 6, "何叔保持前景位置，只轻微垂眼看文件；陈野在后景把视线缓慢移向储物间折叠床并停住。摄影机做一次克制的焦点转移，人物不换位，赵成不进入画面，储物间灯不熄灭。"],
];

const assets = [
  ["role", "AS-CHAR-01 陈野", "角色定妆/AS-CHAR-01_陈野_v001.png", "陈野固定身份与服装参考"],
  ["role", "AS-CHAR-03 何叔", "角色定妆/AS-CHAR-03_何叔_v001.png", "何叔固定身份与服装参考"],
  ["role", "AS-CHAR-04 赵成", "角色定妆/AS-CHAR-04_赵成_v001.png", "赵成固定身份与服装参考"],
  ["scene", "AS-SCENE-01 南站", "场景参考/AS-SCENE-01_南站_v001.png", "南站外景空间参考"],
  ["scene", "AS-SCENE-02 共享办公前台", "场景参考/AS-SCENE-02_共享办公前台_v001.png", "共享办公前台空间参考"],
  ["scene", "AS-SCENE-03 建国图文", "场景参考/AS-SCENE-03_建国图文_v001.png", "建国图文店内空间参考"],
  ["scene", "AS-SCENE-04 储物间", "场景参考/AS-SCENE-04_储物间_v001.png", "储物间空间与轴线参考"],
  ["tool", "AS-PROP-01 旧背包", "道具参考/AS-PROP-01_旧背包_v001.png", "陈野旧背包连续性参考"],
  ["tool", "AS-PROP-02 旧打印机", "道具参考/AS-PROP-02_旧打印机_v001.png", "旧打印机结构参考"],
  ["tool", "AS-PROP-03 清场文件", "道具参考/AS-PROP-03_清场文件_v001.png", "清场文件版式与红章参考"],
  ["tool", "AS-PROP-04 手机", "道具参考/AS-PROP-04_手机_v001.png", "黑色手机外形参考"],
  ["tool", "AS-PROP-10 折叠床与旧桌", "道具参考/AS-PROP-10_折叠床与旧桌_v001.png", "储物间床位与旧桌参考"],
  ["tool", "AS-PROP-11 行李箱", "道具参考/AS-PROP-11_行李箱_v001.png", "深灰小行李箱连续性参考"],
];

/** 将生产资产复制到 Toonflow 的本地对象存储，并返回应用内路径。 */
function copyToOss(sourcePath, projectId, category, fileName) {
  const relative = `/${projectId}/${category}/${fileName}`;
  const target = path.join(appRoot, "data", "oss", relative.replace(/^\//, ""));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return relative.replace(/\\/g, "/");
}

/** 找出分镜目录中与镜头和首尾类型对应的最终版本文件。 */
function findFrame(unitId, side) {
  const dir = path.join(generatedRoot, "第1集分镜静帧");
  const matches = fs.readdirSync(dir).filter((name) => name.startsWith(`${unitId}_${side}_`) && name.endsWith(".png"));
  if (matches.length !== 1) throw new Error(`${unitId} ${side} 帧数量异常：${matches.length}`);
  return path.join(dir, matches[0]);
}

/** 导入独立的第1集样片项目；若同名项目已存在则停止，避免覆盖用户数据。 */
function main() {
  const db = new Database(dbPath);
  if (db.prepare("select id from o_project where name = ?").get(projectName)) {
    throw new Error(`同名项目已存在：${projectName}`);
  }

  const baseId = Date.now();
  const projectId = baseId;
  const scriptId = baseId + 1;
  const packagePath = path.join(storyRoot, "这座城给我一张桌子_第1集样片执行包V2.md");
  const scriptContent = fs.readFileSync(packagePath, "utf8");

  const insertProject = db.prepare("insert into o_project (id, projectType, imageModel, imageQuality, videoModel, name, intro, type, artStyle, directorManual, mode, videoRatio, createTime, userId) values (@id,@projectType,@imageModel,@imageQuality,@videoModel,@name,@intro,@type,@artStyle,@directorManual,@mode,@videoRatio,@createTime,@userId)");
  const insertScript = db.prepare("insert into o_script (id,name,content,projectId,extractState,createTime,errorReason) values (@id,@name,@content,@projectId,@extractState,@createTime,@errorReason)");
  const insertAsset = db.prepare("insert into o_assets (id,name,prompt,remark,type,describe,scriptId,imageId,projectId,startTime,promptState,audioBindState) values (@id,@name,@prompt,@remark,@type,@describe,@scriptId,@imageId,@projectId,@startTime,@promptState,@audioBindState)");
  const insertImage = db.prepare("insert into o_image (id,filePath,type,assetsId,model,resolution,state,errorReason) values (@id,@filePath,@type,@assetsId,@model,@resolution,@state,@errorReason)");
  const insertTrack = db.prepare("insert into o_videoTrack (id,projectId,scriptId,state,reason,prompt,duration) values (@id,@projectId,@scriptId,@state,@reason,@prompt,@duration)");
  const insertBoard = db.prepare("insert into o_storyboard (id,scriptId,prompt,filePath,duration,state,trackId,reason,track,videoDesc,shouldGenerateImage,projectId,flowId,\"index\",createTime) values (@id,@scriptId,@prompt,@filePath,@duration,@state,@trackId,@reason,@track,@videoDesc,@shouldGenerateImage,@projectId,@flowId,@index,@createTime)");

  const importAll = db.transaction(() => {
    insertProject.run({ id: projectId, projectType: "novel", imageModel: "minimax:image-01", imageQuality: "1K", videoModel: "minimax:MiniMax-Hailuo-2.3", name: projectName, intro: "第1集65秒样片：从南站受骗到图文店获得临时床位，再遭遇30天清场通知。", type: "现实主义都市短剧", artStyle: "cinematic_realism", directorManual: "continuity_first", mode: "singleImage", videoRatio: "9:16", createTime: baseId, userId: 1 });
    insertScript.run({ id: scriptId, name: "第1集：第一天，钱没了", content: scriptContent, projectId, extractState: 1, createTime: baseId + 1, errorReason: "" });

    let idCursor = baseId + 100;
    for (const [type, name, relativeSource, describe] of assets) {
      const assetId = idCursor++;
      const imageId = idCursor++;
      const source = path.join(generatedRoot, relativeSource);
      if (!fs.existsSync(source)) throw new Error(`缺少资产：${source}`);
      const appPath = copyToOss(source, projectId, type, path.basename(source));
      insertImage.run({ id: imageId, filePath: appPath, type, assetsId: assetId, model: "imagegen", resolution: "reference", state: "已完成", errorReason: "" });
      insertAsset.run({ id: assetId, name, prompt: describe, remark: "第1集已验收参考图", type, describe, scriptId, imageId, projectId, startTime: baseId, promptState: "已完成", audioBindState: 0 });
    }

    let boardIndex = 0;
    for (let i = 0; i < units.length; i += 1) {
      const [unitId, duration, motionPrompt] = units[i];
      const trackId = baseId + 1000 + i;
      insertTrack.run({ id: trackId, projectId, scriptId, state: "未生成", reason: "", prompt: motionPrompt, duration });
      for (const side of ["start", "end"]) {
        const source = findFrame(unitId, side);
        const fileName = path.basename(source);
        const appPath = copyToOss(source, projectId, "storyboard", fileName);
        insertBoard.run({ id: baseId + 2000 + boardIndex, scriptId, prompt: `${unitId} ${side === "start" ? "首帧" : "尾帧"}，已通过静帧质检`, filePath: appPath, duration: String(duration), state: "已完成", trackId, reason: "", track: unitId, videoDesc: motionPrompt, shouldGenerateImage: 1, projectId, flowId: null, index: boardIndex, createTime: baseId + boardIndex });
        boardIndex += 1;
      }
    }
  });

  importAll();
  console.log(JSON.stringify({ projectId, scriptId, assets: assets.length, frames: units.length * 2, tracks: units.length }, null, 2));
  db.close();
}

main();
