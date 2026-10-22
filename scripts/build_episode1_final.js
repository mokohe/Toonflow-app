const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const storyRoot = "D:\\DATA\\WeMedia\\AIShortPlay\\aishort-play-data\\剧本\\剧本1";
const frameRoot = path.join(storyRoot, "生成资产", "第1集分镜静帧");
const videoRoot = path.join(storyRoot, "生成资产", "第1集动态视频");
const audioRoot = path.join(storyRoot, "生成资产", "第1集声音");
const finalRoot = path.join(storyRoot, "生成资产", "第1集成片");

const units = [
  ["E01-G01", 5], ["E01-G02", 4], ["E01-G03", 5], ["E01-G04", 4],
  ["E01-G05", 5], ["E01-G06", 4], ["E01-G07", 4], ["E01-G08", 4],
  ["E01-G09", 5], ["E01-G10", 4], ["E01-G11", 4], ["E01-G12", 5],
  ["E01-G13", 6], ["E01-G14", 6],
];

const lines = [
  ["01_mother", "zh-CN-XiaoxiaoNeural", "+0%", "到了？", 2600, "母亲"],
  ["02_chen", "zh-CN-YunxiNeural", "-8%", "到了。公司包住。", 5400, "陈野"],
  ["03_chen", "zh-CN-YunxiNeural", "-5%", "远航科技，今天入职。", 10100, "陈野"],
  ["04_system", "zh-CN-XiaoyiNeural", "+5%", "您拨打的电话已关机。", 14300, "系统音"],
  ["05_recruiter", "zh-CN-XiaoyiNeural", "+12%", "需要本地经验。", 18100, "招聘方"],
  ["06_agent", "zh-CN-YunyangNeural", "+15%", "押一付三，最低六千。", 20400, "中介"],
  ["07_customer", "zh-CN-YunjianNeural", "+8%", "三百本，明早投标。", 27300, "客户"],
  ["08_chen", "zh-CN-YunxiNeural", "-3%", "先断电。让我试十分钟。", 31300, "陈野"],
  ["09_customer", "zh-CN-YunjianNeural", "+8%", "哪家公司的？", 40200, "客户"],
  ["10_chen", "zh-CN-YunxiNeural", "-6%", "还没有。", 41900, "陈野"],
  ["11_chen", "zh-CN-YunxiNeural", "-5%", "没换零件，五十。", 44400, "陈野"],
  ["12_he", "zh-CN-YunyangNeural", "-16%", "先住一晚。", 49300, "何叔"],
  ["13_zhao", "zh-CN-YunjianNeural", "-8%", "何老板，三十天。到期清场。", 54100, "赵成"],
  ["14_he", "zh-CN-YunyangNeural", "-18%", "这张床，也睡不了几天。", 60600, "何叔"],
];

/** 执行外部媒体命令，失败时显示正在处理的具体步骤。 */
function run(tool, args, label, cwd) {
  console.log(label);
  execFileSync(tool, args, { stdio: "inherit", cwd });
}

/** 定位某镜头唯一的最终首帧或尾帧版本。 */
function findFrame(unit, side) {
  const matches = fs.readdirSync(frameRoot).filter((name) => name.startsWith(`${unit}_${side}_`) && name.endsWith(".png"));
  if (matches.length !== 1) throw new Error(`${unit} ${side} 帧数量异常：${matches.length}`);
  return path.join(frameRoot, matches[0]);
}

/** 将模型视频裁切并统一到竖屏、24帧和相同编码参数。 */
function normalizeModelClip(unit, duration, target) {
  const source = path.join(videoRoot, `${unit}_source_6s_v001.mp4`);
  run("ffmpeg", ["-y", "-v", "error", "-i", source, "-t", String(duration), "-vf", "scale=768:1364:force_original_aspect_ratio=increase,crop=768:1364,fps=24", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", target], `标准化 ${unit}`);
}

/** 用已验收首尾静帧构造克制运动镜头，替代换脸或模型未生成的片段。 */
function buildFallbackClip(unit, duration, target) {
  const start = findFrame(unit, "start");
  const end = findFrame(unit, "end");
  const fade = 0.6;
  const segment = duration / 2 + fade / 2;
  const offset = segment - fade;
  const frameCount = Math.ceil(segment * 24);
  const prep = `scale=820:1457:force_original_aspect_ratio=increase,crop=820:1457,zoompan=z='min(zoom+0.00045,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=768x1364:fps=24,setsar=1`;
  const filter = `[0:v]${prep}[a];[1:v]${prep}[b];[a][b]xfade=transition=fade:duration=${fade}:offset=${offset},fps=24[out]`;
  run("ffmpeg", ["-y", "-v", "error", "-loop", "1", "-t", String(segment), "-i", start, "-loop", "1", "-t", String(segment), "-i", end, "-filter_complex", filter, "-map", "[out]", "-t", String(duration), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", target], `制作静帧替代镜头 ${unit}`);
}

/** 使用本机中文语音生成对白，并用音高区分角色，避免云端接口波动阻塞成片。 */
function generateVoices() {
  const pitchByVoice = {
    "zh-CN-XiaoxiaoNeural": 1.0,
    "zh-CN-XiaoyiNeural": 1.04,
    "zh-CN-YunxiNeural": 0.84,
    "zh-CN-YunjianNeural": 0.76,
    "zh-CN-YunyangNeural": 0.70,
  };
  const rateByVoice = {
    "zh-CN-XiaoxiaoNeural": 0,
    "zh-CN-XiaoyiNeural": 2,
    "zh-CN-YunxiNeural": -1,
    "zh-CN-YunjianNeural": 0,
    "zh-CN-YunyangNeural": -2,
  };
  for (const [name, voice, , text] of lines) {
    const raw = path.join(audioRoot, `${name}_sapi.wav`);
    const target = path.join(audioRoot, `${name}.mp3`);
    const escapePs = (value) => value.replace(/'/g, "''");
    const command = `Add-Type -AssemblyName System.Speech; $s=[System.Speech.Synthesis.SpeechSynthesizer]::new(); $s.Rate=${rateByVoice[voice] ?? 0}; $s.SetOutputToWaveFile('${escapePs(raw)}'); $s.Speak('${escapePs(text)}'); $s.Dispose()`;
    const encoded = Buffer.from(command, "utf16le").toString("base64");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand", encoded], `生成本地配音 ${name}`);
    const sampleRate = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "default=nw=1:nk=1", raw], { encoding: "utf8" }).trim();
    const factor = pitchByVoice[voice] ?? 1;
    const tempo = (1 / factor).toFixed(6);
    run("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", `asetrate=${sampleRate}*${factor},aresample=48000,atempo=${tempo}`, "-codec:a", "libmp3lame", "-q:a", "2", target], `调整角色音色 ${name}`);
  }
}

/** 写出 ASS 字幕，同时覆盖剧情要求的手机和文件关键信息。 */
function writeAss(target) {
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 768\nPlayResY: 1364\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Dialogue,Microsoft YaHei,43,&H00FFFFFF,&H00FFFFFF,&H00151515,&H90000000,-1,0,0,0,100,100,0,0,1,3,1,2,50,50,96,1\nStyle: Overlay,Microsoft YaHei,35,&H00FFFFFF,&H00FFFFFF,&H00151515,&H90000000,-1,0,0,0,100,100,0,0,3,2,0,8,60,60,100,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:02.60,0:00:03.60,Dialogue,母亲,0,0,0,,到了？\nDialogue: 0,0:00:05.40,0:00:08.20,Dialogue,陈野,0,0,0,,到了。公司包住。\nDialogue: 1,0:00:05.20,0:00:08.80,Overlay,界面,0,0,0,,银行卡余额 128.40元\nDialogue: 0,0:00:10.10,0:00:13.40,Dialogue,陈野,0,0,0,,远航科技，今天入职。\nDialogue: 0,0:00:14.30,0:00:17.50,Dialogue,系统音,0,0,0,,您拨打的电话已关机。\nDialogue: 1,0:00:14.10,0:00:17.80,Overlay,界面,0,0,0,,培训保证金转账  -3000元\nDialogue: 0,0:00:18.10,0:00:20.10,Dialogue,招聘方,0,0,0,,需要本地经验。\nDialogue: 0,0:00:20.40,0:00:22.90,Dialogue,中介,0,0,0,,押一付三，最低六千。\nDialogue: 1,0:00:21.80,0:00:23.00,Overlay,界面,0,0,0,,电量 3%\nDialogue: 1,0:00:24.40,0:00:25.60,Overlay,输入框,0,0,0,,被 骗 了\nDialogue: 0,0:00:27.30,0:00:30.20,Dialogue,客户,0,0,0,,三百本，明早投标。\nDialogue: 0,0:00:31.30,0:00:34.70,Dialogue,陈野,0,0,0,,先断电。让我试十分钟。\nDialogue: 0,0:00:40.20,0:00:41.80,Dialogue,客户,0,0,0,,哪家公司的？\nDialogue: 0,0:00:41.90,0:00:43.30,Dialogue,陈野,0,0,0,,还没有。\nDialogue: 0,0:00:44.40,0:00:47.30,Dialogue,陈野,0,0,0,,没换零件，五十。\nDialogue: 0,0:00:49.30,0:00:51.70,Dialogue,何叔,0,0,0,,先住一晚。\nDialogue: 0,0:00:54.10,0:00:58.30,Dialogue,赵成,0,0,0,,何老板，三十天。到期清场。\nDialogue: 1,0:00:59.10,0:01:03.80,Overlay,文件,0,0,0,,《商铺终止经营告知书》  期限：30天\nDialogue: 0,0:01:00.60,0:01:04.60,Dialogue,何叔,0,0,0,,这张床，也睡不了几天。\n`;
  fs.writeFileSync(target, ass, "utf8");
}

/** 完成镜头拼接、环境底噪、对白混音和字幕烧录。 */
function buildFinal() {
  fs.mkdirSync(audioRoot, { recursive: true });
  fs.mkdirSync(finalRoot, { recursive: true });
  const clipRoot = path.join(finalRoot, "clips");
  fs.mkdirSync(clipRoot, { recursive: true });

  const clipPaths = [];
  for (const [unit, duration] of units) {
    const target = path.join(clipRoot, `${unit}_${duration}s.mp4`);
    if (unit === "E01-G11" || unit === "E01-G12") buildFallbackClip(unit, duration, target);
    else normalizeModelClip(unit, duration, target);
    clipPaths.push(target);
  }

  const concatPath = path.join(finalRoot, "第1集镜头拼接清单.txt");
  fs.writeFileSync(concatPath, clipPaths.map((item) => `file '${item.replace(/'/g, "'\\''").replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const silent = path.join(finalRoot, "第1集画面无声_v001.mp4");
  run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", silent], "拼接65秒画面");

  generateVoices();
  const ambient = path.join(audioRoot, "第1集环境底音_v001.wav");
  run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anoisesrc=color=pink:sample_rate=48000:duration=65", "-af", "lowpass=f=1100,volume=0.018,afade=t=in:st=0:d=1,afade=t=out:st=63:d=2", ambient], "生成克制环境底音");

  const assPath = path.join(finalRoot, "第1集字幕与界面覆盖_v001.ass");
  writeAss(assPath);
  const final = path.join(finalRoot, "这座城给我一张桌子_第1集样片_v001.mp4");
  const inputArgs = ["-y", "-v", "error", "-i", silent, "-i", ambient];
  for (const [name] of lines) inputArgs.push("-i", path.join(audioRoot, `${name}.mp3`));
  const filters = ["[1:a]volume=0.55[amb]"];
  const mixInputs = ["[amb]"];
  for (let index = 0; index < lines.length; index += 1) {
    const delay = lines[index][4];
    filters.push(`[${index + 2}:a]adelay=${delay}|${delay},volume=1.15[v${index}]`);
    mixInputs.push(`[v${index}]`);
  }
  filters.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=longest:normalize=0,alimiter=limit=0.95[aout]`);
  const escapedAss = path.basename(assPath).replace(/'/g, "\\'");
  run("ffmpeg", [...inputArgs, "-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]", "-vf", `subtitles='${escapedAss}',tpad=stop_mode=clone:stop_duration=0.3`, "-t", "65", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final], "混音、字幕与最终成片", finalRoot);
  console.log(final);
}

buildFinal();
