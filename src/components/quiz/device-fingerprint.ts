// 修了証の「なりすまし防止情報」用：端末識別コードなどを集める。
// 既存のネットワーク構築課題の修了証と同じ方式（同じ端末なら同じ識別コードになる）。
const DEVICE_ID_KEY = 'joholife_device_id';

export function generateHash(input: string): string {
  let hash = 0;
  if (input.length === 0) return hash.toString();
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash; // 32bit integer
  }
  return Math.abs(hash).toString(16);
}

function pluginsList(): string {
  try {
    return Array.from(navigator.plugins || []).map((p) => p.name).sort().join(',');
  } catch {
    return 'unknown';
  }
}

function canvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    canvas.width = 200;
    canvas.height = 50;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Canvas fingerprint test 🎯', 2, 2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(50, 1, 62, 20);
    return generateHash(canvas.toDataURL()).substr(0, 8);
  } catch {
    return 'canvas_error';
  }
}

function webglFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'no_webgl';
    const info: Record<string, unknown> = {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
      aliasedPointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
    };
    const ext = gl.getSupportedExtensions();
    info.extensions = ext ? ext.sort().join(',') : '';
    return generateHash(JSON.stringify(info)).substr(0, 8);
  } catch {
    return 'webgl_error';
  }
}

function audioFingerprint(): string {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ac = new Ctx();
    const d = ac.destination;
    const info = {
      sampleRate: ac.sampleRate, maxChannelCount: d.maxChannelCount, numberOfInputs: d.numberOfInputs,
      numberOfOutputs: d.numberOfOutputs, channelCount: d.channelCount,
      channelCountMode: d.channelCountMode, channelInterpretation: d.channelInterpretation,
    };
    return generateHash(JSON.stringify(info)).substr(0, 8);
  } catch {
    return 'audio_error';
  }
}

function browserFingerprint(): string {
  const basic = {
    userAgent: navigator.userAgent || 'unknown',
    language: navigator.language || 'unknown',
    languages: navigator.languages ? navigator.languages.join(',') : 'unknown',
    platform: navigator.platform || 'unknown',
    vendor: navigator.vendor || 'unknown',
    cookieEnabled: navigator.cookieEnabled || false,
    doNotTrack: navigator.doNotTrack || 'unknown',
    screenResolution: `${screen.width}x${screen.height}` || 'unknown',
    colorDepth: screen.colorDepth || 'unknown',
    pixelDepth: screen.pixelDepth || 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 'yes' : 'no',
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    pixelRatio: window.devicePixelRatio || 1,
    plugins: pluginsList(),
  };
  const combined = { basic, canvas: canvasFingerprint(), webgl: webglFingerprint(), audio: audioFingerprint() };
  return generateHash(JSON.stringify(combined)).substr(0, 12);
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateHash(browserFingerprint()).substr(0, 8).toUpperCase();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function fetchIpAddress(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    return (await res.json()).ip;
  } catch {
    return 'Unknown';
  }
}

export function trackingInfo(ipAddress: string) {
  const ua = navigator.userAgent;
  const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Other';
  const os = ua.includes('Windows') ? 'Win' : ua.includes('Mac') ? 'Mac' : ua.includes('Linux') ? 'Linux' : 'Other';
  return {
    timestamp: new Date().toLocaleString('ja-JP', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ipAddress,
    userAgent: `${browser}/${os}`,
    screenInfo: `${screen.width}x${screen.height}`,
    deviceUserHash: getOrCreateDeviceId(),
  };
}
