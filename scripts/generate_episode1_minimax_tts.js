const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const outputRoot = "D:\\DATA\\WeMedia\\AIShortPlay\\aishort-play-data\\剧本\\剧本1\\生成资产\\第1集声音\\MiniMax正式配音_v001";
const lines = [
  { name: "01_mother", role: "母亲", text: "到了？", delay: 2600, preferredVoice: "female-chengshu", fallbackVoice: "female-yujie", speed: 0.93, pitch: -1 },
  { name: "02_chen", role: "陈野", text: "到了。公司包住。", delay: 5400, preferredVoice: "male-qn-qingse", fallbackVoice: "male-qn-daxuesheng", speed: 0.95, pitch: -1 },
  { name: "03_chen", role: "陈野", text: "远航科技，今天入职。", delay: 10100, preferredVoice: "male-qn-qingse", fallbackVoice: "male-qn-daxuesheng", speed: 0.96, pitch: -1 },
  { name: "04_system", role: "系统音", text: "您拨打的电话已关机。", delay: 14300, preferredVoice: "female-chengshu", fallbackVoice: "female-yujie", speed: 1.03, pitch: 0 },
  { name: "05_recruiter", role: "招聘方", text: "需要本地经验。", delay: 18100, preferredVoice: "female-yujie", fallbackVoice: "female-chengshu", speed: 1.02, pitch: 0 },
  { name: "06_agent", role: "中介", text: "押一付三，最低六千。", delay: 20400, preferredVoice: "male-qn-jingying", fallbackVoice: "male-qn-badao", speed: 1.04, pitch: 0 },
  { name: "07_customer", role: "客户", text: "三百本，明早投标。", delay: 27300, preferredVoice: "male-qn-badao", fallbackVoice: "male-qn-jingying", speed: 1.02, pitch: -1 },
  { name: "08_chen", role: "陈野", text: "先断电。让我试十分钟。", delay: 31300, preferredVoice: "male-qn-qingse", fallbackVoice: "male-qn-daxuesheng", speed: 1.0, pitch: -1 },
  { name: "09_customer", role: "客户", text: "哪家公司的？", delay: 40200, preferredVoice: "male-qn-badao", fallbackVoice: "male-qn-jingying", speed: 1.02, pitch: -1 },
  { name: "10_chen", role: "陈野", text: "还没有。", delay: 42200, preferredVoice: "male-qn-qingse", fallbackVoice: "male-qn-daxuesheng", speed: 0.92, pitch: -1 },
  { name: "11_chen", role: "陈野", text: "没换零件，五十。", delay: 44400, preferredVoice: "male-qn-qingse", fallbackVoice: "male-qn-daxuesheng", speed: 0.95, pitch: -1 },
  { name: "12_he", role: "何叔", text: "先住一晚。", delay: 49300, preferredVoice: "Chinese (Mandarin)_Reliable_Executive", fallbackVoice: "male-qn-jingying", speed: 0.86, pitch: -3 },
  { name: "13_zhao", role: "赵成", text: "何老板，三十天。到期清场。", delay: 54100, preferredVoice: "male-qn-jingying", fallbackVoice: "male-qn-badao", speed: 0.92, pitch: -1 },
  { name: "14_he", role: "何叔", text: "这张床，也睡不了几天。", delay: 60600, preferredVoice: "Chinese (Mandarin)_Reliable_Executive", fallbackVoice: "male-qn-jingying", speed: 0.84, pitch: -3 },
];

/** 从 Toonflow 本地配置读取 MiniMax 凭据，避免在脚本和日志中复制密钥。 */
function loadMiniMaxConfig() {
  const db = new Database("data/db2.sqlite", { readonly: true });
  const row = db.prepare("select inputValues from o_vendorConfig where id=?").get("minimax");
  db.close();
  if (!row) throw new Error("未找到 MiniMax 供应商配置");
  const config = JSON.parse(row.inputValues || "{}");
  const apiKey = String(config.apiKey || "").replace(/^Bearer\s+/i, "");
  if (!apiKey) throw new Error("MiniMax API Key 为空");
  return { apiKey, baseUrl: String(config.baseUrl || "https://api.minimaxi.com").replace(/\/$/, "") };
}

/** 调用 MiniMax JSON API，并将平台错误转换成可定位的异常。 */
async function postMiniMax(config, endpoint, body) {
  const response = await fetch(`${config.baseUrl}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  const statusCode = result?.base_resp?.status_code;
  if (!response.ok || statusCode !== 0) {
    throw new Error(`HTTP ${response.status} / ${statusCode}: ${result?.base_resp?.status_msg || "未知错误"}`);
  }
  return result;
}

/** 查询当前账户实际可用音色，避免因平台音色调整导致批量失败。 */
async function getAvailableVoiceIds(config) {
  const result = await postMiniMax(config, "/v1/get_voice", { voice_type: "system" });
  return new Set((result.system_voice || []).map((voice) => voice.voice_id));
}

/** 生成单句语音，使用非流式十六进制结果以便立即持久化。 */
async function synthesizeLine(config, line, voiceId) {
  const result = await postMiniMax(config, "/v1/t2a_v2", {
    model: "speech-2.8-turbo",
    text: line.text,
    stream: false,
    language_boost: "Chinese",
    output_format: "hex",
    voice_setting: { voice_id: voiceId, speed: line.speed, vol: 1, pitch: line.pitch },
    audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
    subtitle_enable: false,
    aigc_watermark: false,
  });
  const audioHex = result?.data?.audio;
  if (!audioHex || typeof audioHex !== "string") throw new Error("接口未返回音频数据");
  return { buffer: Buffer.from(audioHex, "hex"), info: result.extra_info || {} };
}

/** 依次生成第1集正式对白，记录音色、延时和计费字符数。 */
async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const config = loadMiniMaxConfig();
  const available = await getAvailableVoiceIds(config);
  const manifest = [];
  for (const line of lines) {
    const voiceId = available.has(line.preferredVoice) ? line.preferredVoice : line.fallbackVoice;
    let generated;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        generated = await synthesizeLine(config, line, voiceId);
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
      }
    }
    if (!generated) throw new Error(`${line.name} 生成失败：${lastError?.message || "未知错误"}`);
    const filePath = path.join(outputRoot, `${line.name}.mp3`);
    fs.writeFileSync(filePath, generated.buffer);
    const item = {
      name: line.name,
      role: line.role,
      text: line.text,
      voiceId,
      delayMs: line.delay,
      audioLengthMs: generated.info.audio_length,
      usageCharacters: generated.info.usage_characters,
      file: path.basename(filePath),
    };
    manifest.push(item);
    console.log(`${line.name} ${voiceId} ${item.audioLengthMs}ms ${item.usageCharacters}字符`);
  }
  fs.writeFileSync(path.join(outputRoot, "配音清单.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`TOTAL_USAGE_CHARACTERS=${manifest.reduce((sum, item) => sum + Number(item.usageCharacters || 0), 0)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
