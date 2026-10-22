const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const projectId = 1786178088306;
const scriptId = 1786178088307;
const appRoot = path.resolve(__dirname, "..");
const clipRoot = "D:\\DATA\\WeMedia\\AIShortPlay\\aishort-play-data\\剧本\\剧本1\\生成资产\\第1集成片\\clips";

/** 将14条最终剪辑版写回 Toonflow，并设为各轨道当前选中视频。 */
function main() {
  const db = new Database(path.join(appRoot, "data", "db2.sqlite"));
  const boards = db.prepare("select track,trackId,duration from o_storyboard where projectId=? group by track,trackId order by min(id)").all(projectId);
  const insertVideo = db.prepare("insert into o_video (id,filePath,errorReason,time,state,scriptId,projectId,videoTrackId) values (@id,@filePath,@errorReason,@time,@state,@scriptId,@projectId,@videoTrackId)");
  const updateTrack = db.prepare("update o_videoTrack set videoId=?,selectVideoId=?,state=? where id=?");
  const existing = db.prepare("select id from o_video where projectId=? and videoTrackId=? and filePath=?");
  const maxId = db.prepare("select coalesce(max(id),0) id from o_video").get().id;
  let nextId = Math.max(Date.now(), maxId + 1);

  const importAll = db.transaction(() => {
    for (const board of boards) {
      const duration = Number(board.duration);
      const source = path.join(clipRoot, `${board.track}_${duration}s.mp4`);
      if (!fs.existsSync(source)) throw new Error(`缺少剪辑版：${source}`);
      const relative = `/${projectId}/video/final/${path.basename(source)}`;
      const target = path.join(appRoot, "data", "oss", relative.replace(/^\//, ""));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      let row = existing.get(projectId, board.trackId, relative);
      if (!row) {
        row = { id: nextId++ };
        insertVideo.run({ id: row.id, filePath: relative, errorReason: "", time: Date.now(), state: "生成成功", scriptId, projectId, videoTrackId: board.trackId });
      }
      updateTrack.run(row.id, row.id, "已完成", board.trackId);
      console.log(`${board.track}: selectedVideoId=${row.id}`);
    }
  });
  importAll();
  db.close();
}

main();
