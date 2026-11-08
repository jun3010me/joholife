/**
 * パソコンで選んだファイルを読み込む（アップロードの前半）。
 * 文字コードの判定は engine の decodeUploadedText。外部への通信は行わない。
 */
import { decodeUploadedText } from '../../utils/linux-terminal/engine/index.ts';
import type { UploadFile, UploadRejected } from '../../utils/linux-terminal/engine/index.ts';

/** 一度に読み込むファイルの数と大きさの上限（ブラウザが固まらないように） */
export const MAX_UPLOAD_FILES = 1000;
export const MAX_UPLOAD_BYTES = 4_000_000;
/** 1ファイルの上限（バイト）。engine の MAX_FILE_CONTENT（文字数）は、UTF-8 で最大 4 倍のバイト数になる */
const MAX_FILE_BYTES = 400_000;

export interface ReadResult {
  items: UploadFile[];
  rejected: UploadRejected[];
  /** 読み込み自体をやめた理由 */
  fatal?: string;
}

/** 選んだファイルの、選んだ場所からの相対パス（フォルダを選んだときは フォルダ名/中のパス） */
export function relativePathOf(file: File): string {
  return file.webkitRelativePath && file.webkitRelativePath !== '' ? file.webkitRelativePath : file.name;
}

export async function readUploadFiles(files: File[]): Promise<ReadResult> {
  if (files.length > MAX_UPLOAD_FILES) {
    return {
      items: [],
      rejected: [],
      fatal: `一度にアップロードできるのは ${MAX_UPLOAD_FILES} ファイルまでです（選んだのは ${files.length} ファイル）`,
    };
  }
  const total = files.reduce((a, f) => a + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    return {
      items: [],
      rejected: [],
      fatal: `合計が大きすぎます（${Math.ceil(MAX_UPLOAD_BYTES / 1_000_000)}MB まで）。必要なファイルだけを選びましょう`,
    };
  }
  const items: UploadFile[] = [];
  const rejected: UploadRejected[] = [];
  for (const file of files) {
    const relativePath = relativePathOf(file);
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ relativePath, message: 'ファイルが大きすぎます。UTF-8 のテキストファイルだけアップロードできます' });
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const decoded = decodeUploadedText(bytes);
      if (decoded.ok) items.push({ relativePath, content: decoded.text });
      else rejected.push({ relativePath, message: decoded.message });
    } catch {
      rejected.push({ relativePath, message: 'ファイルを読み込めませんでした' });
    }
  }
  return { items, rejected };
}
