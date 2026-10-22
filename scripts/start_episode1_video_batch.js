const Database = require("better-sqlite3");

const projectId = 1786178088306;
const scriptId = 1786178088307;
const apiRoot = "http://127.0.0.1:10588/api";

/** 调用 Toonflow 接口并在失败时保留完整响应，便于定位单镜问题。 */
async function postJson(url, body, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} ${response.status}: ${text}`);
  return JSON.parse(text);
}

/** 依次提交第1集剩余镜头，降低瞬间并发导致供应商限流的概率。 */
async function main() {
  const login = await postJson(`${apiRoot}/login/login`, { username: "admin", password: "admin123" });
  const token = login.data.token;
  const db = new Database("data/db2.sqlite", { readonly: true });
  const rows = db.prepare(`
    select t.id as trackId, t.prompt, s.id as boardId, s.track
    from o_videoTrack t
    join o_storyboard s on s.trackId = t.id
    where t.projectId = ? and t.scriptId = ? and s."index" % 2 = 0
      and not exists (
        select 1 from o_video v
        where v.videoTrackId = t.id and v.state = '生成成功'
      )
    order by s."index"
  `).all(projectId, scriptId);
  db.close();

  for (const row of rows) {
    const result = await postJson(`${apiRoot}/production/workbench/generateVideo`, {
      projectId,
      scriptId,
      uploadData: [{ id: row.boardId, sources: "storyboard" }],
      prompt: row.prompt,
      model: "minimax:MiniMax-Hailuo-2.3",
      mode: "singleImage",
      resolution: "768P",
      duration: 6,
      audio: false,
      trackId: row.trackId,
    }, token);
    console.log(`${row.track}: videoId=${result.data}`);
    // 轻微错峰提交，避免所有远程任务在同一毫秒启动。
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
