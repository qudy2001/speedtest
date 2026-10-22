const $ = (id) => document.getElementById(id);
const start = $('start');
const gauge = $('gauge');
let running = false;

function status(phase, message, progress) {
  $('phase').textContent = phase;
  $('message').textContent = message;
  $('progress').style.width = `${progress}%`;
  gauge.style.setProperty('--arc', `${Math.min(280, progress * 2.8)}deg`);
}
function speed(mbps) {
  $('main-speed').textContent = mbps.toFixed(1);
}
function mbps(bytes, ms) { return bytes * 8 / Math.max(ms, 1) / 1000; }

async function loadInfo() {
  $('server').textContent = location.host;
  try {
    const response = await fetch('/api/info', { cache: 'no-store' });
    if (!response.ok) throw Error('无法读取 IP');
    $('ip').textContent = (await response.json()).ip || '未知';
  } catch { $('ip').textContent = '无法获取'; }
}

async function pingTest() {
  const samples = [];
  for (let i = 0; i < 8; i++) {
    const t = performance.now();
    const response = await fetch(`/api/ping?t=${Math.random()}`, { cache: 'no-store' });
    if (!response.ok) throw Error('延迟测试失败');
    await response.arrayBuffer();
    samples.push(performance.now() - t);
    status('测量延迟', `延迟测试 ${i + 1} / 8`, 5 + (i + 1) * 2.5);
  }
  samples.sort((a, b) => a - b);
  const median = (samples[3] + samples[4]) / 2;
  const jitter = samples.slice(1).reduce((sum, n, i) => sum + Math.abs(n - samples[i]), 0) / 7;
  $('ping').textContent = median.toFixed(0);
  $('jitter').textContent = jitter.toFixed(0);
}

async function downloadTest() {
  const started = performance.now();
  let bytes = 0;
  let rounds = 0;
  while (performance.now() - started < 5000 || rounds < 2) {
    const response = await fetch(`/api/download?bytes=${16 * 1024 * 1024}&t=${Math.random()}`, { cache: 'no-store' });
    if (!response.ok || !response.body) throw Error('下载测试失败');
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      const current = mbps(bytes, performance.now() - started);
      speed(current);
      $('download').textContent = current.toFixed(1);
      status('下载中', `已接收 ${(bytes / 1048576).toFixed(1)} MB`, 25 + Math.min(35, (performance.now() - started) / 5000 * 35));
    }
    rounds++;
    if (rounds >= 4) break;
  }
  $('download').textContent = mbps(bytes, performance.now() - started).toFixed(1);
}

async function uploadTest() {
  const payload = new Uint8Array(8 * 1024 * 1024);
  const started = performance.now();
  let bytes = 0;
  let rounds = 0;
  while (performance.now() - started < 5000 || rounds < 2) {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: payload,
      cache: 'no-store',
    });
    if (!response.ok) throw Error('上传测试失败');
    const result = await response.json();
    if (result.bytes !== payload.byteLength) throw Error('上传数据不完整');
    bytes += result.bytes;
    const current = mbps(bytes, performance.now() - started);
    speed(current);
    $('upload').textContent = current.toFixed(1);
    status('上传中', `已发送 ${(bytes / 1048576).toFixed(1)} MB`, 60 + Math.min(39, (performance.now() - started) / 5000 * 39));
    rounds++;
    if (rounds >= 4) break;
  }
  $('upload').textContent = mbps(bytes, performance.now() - started).toFixed(1);
}

start.addEventListener('click', async () => {
  if (running) return;
  running = true;
  start.disabled = true;
  $('button-text').textContent = '测试进行中';
  for (const id of ['download', 'upload', 'ping', 'jitter']) $(id).textContent = '—';
  $('main-speed').textContent = '—';
  try {
    status('开始测试', '正在连接服务器…', 3);
    await pingTest();
    await downloadTest();
    await uploadTest();
    status('测试完成', '连接表现已测量完成', 100);
  } catch (error) {
    status('测试中断', error.message || '连接失败，请重试', 0);
  } finally {
    running = false;
    start.disabled = false;
    $('button-text').textContent = '重新测速';
  }
});

loadInfo();
