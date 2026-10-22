const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const storyRoot = "D:\\DATA\\WeMedia\\AIShortPlay\\aishort-play-data\\剧本\\剧本1";
const voiceRoot = path.join(storyRoot, "生成资产", "第1集声音", "MiniMax正式配音_v001");
const sfxRoot = path.join(storyRoot, "生成资产", "第1集声音", "音效素材", "Mixkit");
const generatedSfxRoot = path.join(storyRoot, "生成资产", "第1集声音", "音效素材", "本地合成");
const audioRoot = path.join(storyRoot, "生成资产", "第1集声音");
const finalRoot = path.join(storyRoot, "生成资产", "第1集成片");

const voices = [
  ["01_mother", 2600], ["02_chen", 5400], ["03_chen", 10100], ["04_system", 14300],
  ["05_recruiter", 18100], ["06_agent", 20400], ["07_customer", 27300], ["08_chen", 31300],
  ["09_customer", 40200], ["10_chen", 42200], ["11_chen", 44400], ["12_he", 49300],
  ["13_zhao", 54100], ["14_he", 60600],
];

/** 执行媒体命令并标记当前声音制作步骤。 */
function run(args, label) {
  console.log(label);
  execFileSync("ffmpeg", args, { stdio: "inherit" });
}

/** 生成版权独立的打印机、开关和结尾张力音，补充素材库没有的关键动作声。 */
function buildGeneratedSfx() {
  fs.mkdirSync(generatedSfxRoot, { recursive: true });
  run(["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=82:sample_rate=48000:duration=4", "-f", "lavfi", "-i", "anoisesrc=color=brown:sample_rate=48000:duration=4", "-filter_complex", "[0:a]volume=0.13,tremolo=f=7:d=0.65[m];[1:a]lowpass=f=650,highpass=f=90,volume=0.24[n];[m][n]amix=inputs=2:normalize=0,afade=t=in:st=0:d=0.08,afade=t=out:st=3.7:d=0.3", path.join(generatedSfxRoot, "printer_fault.wav")], "生成打印机故障声");
  run(["-y", "-v", "error", "-f", "lavfi", "-i", "anoisesrc=color=white:sample_rate=48000:duration=5", "-filter_complex", "highpass=f=1800,lowpass=f=6500,tremolo=f=5:d=0.75,volume=0.09,afade=t=in:st=0:d=0.15,afade=t=out:st=4.6:d=0.4", path.join(generatedSfxRoot, "printer_repair.wav")], "生成清理传感器声");
  run(["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=115:sample_rate=48000:duration=4", "-f", "lavfi", "-i", "anoisesrc=color=pink:sample_rate=48000:duration=4", "-filter_complex", "[0:a]volume=0.12[m];[1:a]lowpass=f=1200,highpass=f=160,volume=0.09[n];[m][n]amix=inputs=2:normalize=0,afade=t=in:st=0:d=0.15,afade=t=out:st=3.65:d=0.35", path.join(generatedSfxRoot, "printer_success.wav")], "生成打印机顺畅运转声");
  run(["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=1150:sample_rate=48000:duration=0.12", "-af", "afade=t=out:st=0.03:d=0.09,volume=0.2", path.join(generatedSfxRoot, "light_switch.wav")], "生成开灯声");
  run(["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=58:sample_rate=48000:duration=6", "-f", "lavfi", "-i", "sine=frequency=87:sample_rate=48000:duration=6", "-filter_complex", "[0:a]volume=0.07[a];[1:a]volume=0.035[b];[a][b]amix=inputs=2:normalize=0,afade=t=in:st=0:d=1.5,afade=t=out:st=5.6:d=0.4", path.join(generatedSfxRoot, "ending_tension.wav")], "生成结尾低频张力音");
}

/** 把正式对白、环境声和逐动作音效混合成65秒立体声音轨。 */
function buildMix() {
  const inputs = [];
  for (const [name] of voices) inputs.push("-i", path.join(voiceRoot, `${name}.mp3`));
  const sfx = {
    station: path.join(sfxRoot, "train_station_2677.mp3"),
    city: path.join(sfxRoot, "city_traffic_2930.mp3"),
    rain: path.join(sfxRoot, "light_rain_2393.mp3"),
    door: path.join(sfxRoot, "sliding_door_182.mp3"),
    phone: path.join(sfxRoot, "phone_dial_2862.mp3"),
    paperSlide: path.join(sfxRoot, "paper_slide_1530.mp3"),
    paperMove: path.join(sfxRoot, "paper_move_2379.mp3"),
    office: path.join(sfxRoot, "office_ambience_447.mp3"),
    footsteps: path.join(sfxRoot, "footsteps_tunnel_543.mp3"),
    chime: path.join(sfxRoot, "station_chime_1569.mp3"),
    coins: path.join(sfxRoot, "coins_1939.mp3"),
    printerFault: path.join(generatedSfxRoot, "printer_fault.wav"),
    printerRepair: path.join(generatedSfxRoot, "printer_repair.wav"),
    printerSuccess: path.join(generatedSfxRoot, "printer_success.wav"),
    lightSwitch: path.join(generatedSfxRoot, "light_switch.wav"),
    ending: path.join(generatedSfxRoot, "ending_tension.wav"),
  };
  const sfxNames = Object.keys(sfx);
  for (const name of sfxNames) inputs.push(name === "office" ? "-stream_loop" : "-i", ...(name === "office" ? ["-1", "-i", sfx[name]] : [sfx[name]]));

  const filters = [];
  const mixLabels = [];
  for (let index = 0; index < voices.length; index += 1) {
    const delay = voices[index][1];
    filters.push(`[${index}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${delay}|${delay},volume=1.2[v${index}]`);
    mixLabels.push(`[v${index}]`);
  }
  const base = voices.length;
  const idx = Object.fromEntries(sfxNames.map((name, index) => [name, base + index]));
  const add = (label, expression) => { filters.push(expression); mixLabels.push(`[${label}]`); };

  add("station", `[${idx.station}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:9,afade=t=out:st=8:d=1,volume=0.22[station]`);
  add("city", `[${idx.city}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:5,volume=0.12[city]`);
  add("rain", `[${idx.rain}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:9,afade=t=in:st=0:d=0.4,afade=t=out:st=8.3:d=0.7,adelay=18000|18000,volume=0.34[rain]`);
  filters.push(`[${idx.office}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[officeA0][officeB0]`);
  add("officeA", `[officeA0]atrim=0:9,adelay=9000|9000,volume=0.13[officeA]`);
  add("officeB", `[officeB0]atrim=0:38,adelay=27000|27000,volume=0.14[officeB]`);

  filters.push(`[${idx.door}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[doorA0][doorB0]`);
  add("doorA", `[doorA0]atrim=0:0.9,adelay=9000|9000,volume=0.55[doorA]`);
  add("doorB", `[doorB0]atrim=0:0.9,adelay=53000|53000,volume=0.55[doorB]`);
  filters.push(`[${idx.phone}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=3[phoneA0][phoneB0][phoneC0]`);
  add("phoneA", `[phoneA0]atrim=0:0.7,adelay=14000|14000,volume=0.32[phoneA]`);
  add("phoneB", `[phoneB0]atrim=0:0.55,adelay=17800|17800,volume=0.24[phoneB]`);
  add("phoneC", `[phoneC0]atrim=0:0.55,adelay=20100|20100,volume=0.24[phoneC]`);

  filters.push(`[${idx.paperSlide}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=4[paperA0][paperB0][paperC0][paperD0]`);
  add("paperA", `[paperA0]atrim=0:0.9,adelay=42000|42000,volume=0.7[paperA]`);
  add("paperB", `[paperB0]atrim=0:0.9,adelay=47000|47000,volume=0.55[paperB]`);
  add("paperC", `[paperC0]atrim=0:0.9,adelay=57000|57000,volume=0.65[paperC]`);
  add("paperD", `[paperD0]atrim=0:0.9,adelay=59200|59200,volume=0.45[paperD]`);
  add("paperMove", `[${idx.paperMove}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:2.2,adelay=27500|27500,volume=0.32[paperMove]`);

  filters.push(`[${idx.footsteps}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[stepsA0][stepsB0]`);
  add("stepsA", `[stepsA0]atrim=0:2.8,adelay=9700|9700,volume=0.24[stepsA]`);
  add("stepsB", `[stepsB0]atrim=0:2.2,adelay=53200|53200,volume=0.22[stepsB]`);
  filters.push(`[${idx.chime}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[chimeA0][chimeB0]`);
  add("chimeA", `[chimeA0]atrim=0:1.2,adelay=350|350,volume=0.2[chimeA]`);
  add("chimeB", `[chimeB0]atrim=0:1.0,adelay=53000|53000,volume=0.18[chimeB]`);
  add("coins", `[${idx.coins}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:1.4,adelay=44300|44300,volume=0.48[coins]`);

  add("fault", `[${idx.printerFault}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=27000|27000,volume=0.8[fault]`);
  add("repair", `[${idx.printerRepair}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=35000|35000,volume=0.85[repair]`);
  add("success", `[${idx.printerSuccess}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=40000|40000,volume=0.85[success]`);
  add("switch", `[${idx.lightSwitch}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=49200|49200,volume=0.9[switch]`);
  add("ending", `[${idx.ending}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=59000|59000,volume=0.8[ending]`);

  filters.push(`${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:normalize=0,acompressor=threshold=0.18:ratio=2.5:attack=12:release=180,loudnorm=I=-16:LRA=9:TP=-1.5,aresample=48000[aout]`);
  const mixPath = path.join(audioRoot, "第1集正式混音_MiniMax_v001.wav");
  run(["-y", "-v", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[aout]", "-t", "65", "-c:a", "pcm_s24le", mixPath], "混合正式对白与逐动作音效");
  return mixPath;
}

/** 复制原视频流并替换音轨，确保不重新生成、不重新编码画面。 */
function remuxFinal(mixPath) {
  const source = path.join(finalRoot, "这座城给我一张桌子_第1集样片_v002.mp4");
  const target = path.join(finalRoot, "这座城给我一张桌子_第1集样片_v003_正式配音音效.mp4");
  run(["-y", "-v", "error", "-i", source, "-i", mixPath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-b:a", "192k", "-t", "65", "-movflags", "+faststart", target], "替换成片音轨（画面流直接复制）");
  console.log(target);
}

buildGeneratedSfx();
remuxFinal(buildMix());
