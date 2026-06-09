import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

type DraftQuestion = {
  questionText: string;
  questionType: "multiple_choice" | "short_answer" | "matching";
  score?: number;
  mediaPath?: string | null;
  mediaPreview?: string | null;
  options?: { label: string; text: string; isCorrect?: boolean }[];
  shortAnswers?: string[];
  pairs?: { left: string; right: string }[];
};

function htmlToText(html: string) {
  return html
    .replace(/<img[^>]+src="([^"]+)"[^>]*data-preview="([^"]*)"[^>]*>/gi, "\n[[IMAGE:$1|$2]]\n")
    .replace(/<\/p>|<br\s*\/?>|<\/tr>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readScore(line: string) {
  const direct = line.match(/^(nilai|bobot|skor|score)\s*[:=]\s*(\d+(?:[,.]\d+)?)/i);
  if (direct) return { score: Number(direct[2].replace(",", ".")), line: "" };
  const inline = line.match(/\((?:nilai|bobot|skor|score)?\s*(\d+(?:[,.]\d+)?)\s*(?:poin|point|nilai)\)/i);
  if (!inline) return { score: undefined, line };
  return {
    score: Number(inline[1].replace(",", ".")),
    line: line.replace(inline[0], "").trim()
  };
}

function parseWordText(text: string): DraftQuestion[] {
  const drafts: DraftQuestion[] = [];
  const lines = text
    .split(/\n/g)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let current: DraftQuestion | null = null;
  let currentKey = "";
  let currentNumber: number | null = null;
  let pendingMedia: Pick<DraftQuestion, "mediaPath" | "mediaPreview"> = {};
  const globalKeys = new Map<number, string>();

  function collectGlobalKeysFromTokens() {
    let found = 0;
    const tokens = lines.flatMap((line) =>
      line
        .split(/\s+/g)
        .map((token) => token.replace(/[^0-9A-Ea-e]/g, ""))
        .filter(Boolean)
    );
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const number = tokens[index];
      const key = tokens[index + 1];
      if (/^\d{1,3}$/.test(number) && /^[A-E]$/i.test(key)) {
        globalKeys.set(Number(number), key.toUpperCase());
        found += 1;
        index += 1;
      }
    }
    return found >= 2;
  }

  function collectGlobalKeys(line: string) {
    const matches = [...line.matchAll(/(?:^|\s)(\d{1,3})\s*[:.\-]?\s*([A-E])(?:\s|$)/gi)];
    if (matches.length < 2) return false;
    matches.forEach((match) => {
      globalKeys.set(Number(match[1]), match[2].toUpperCase());
    });
    return true;
  }

  lines.forEach((line) => collectGlobalKeys(line));
  collectGlobalKeysFromTokens();

  function isInstruction(line: string) {
    return [
      /^soal\s+fisika$/i,
      /^teori\s+kinetik/i,
      /^disusun\s+untuk/i,
      /^nama$/i,
      /^kelas$/i,
      /^tanggal$/i,
      /^[:.]+$/,
      /^petunjuk:?$/i,
      /^pilihlah\s+satu\s+jawaban/i,
      /^gunakan\s+r\s*=/i,
      /^semua\s+suhu/i,
      /^[A-Z]\.\s*soal\s+pilihan\s+ganda$/i,
      /^[A-Z]\.\s*kunci\s+jawaban:?$/i,
      /^kunci\s+jawaban:?$/i,
      /^catatan\s+untuk\s+belajar:?$/i
    ].some((pattern) => pattern.test(line));
  }

  function pushCurrent() {
    if (!current?.questionText.trim()) return;
    if (current.questionType === "multiple_choice" && current.options && current.options.length >= 2) {
      const key = currentKey || (currentNumber ? globalKeys.get(currentNumber) ?? "" : "");
      if (key) {
        current.options = current.options.map((option) => ({
          ...option,
          isCorrect: option.label.toUpperCase() === key.toUpperCase()
        }));
      }
      drafts.push({ ...current, score: current.score ?? 1 });
      return;
    }
    if (current.questionType === "matching" && current.pairs?.length) {
      drafts.push({ ...current, score: current.score ?? 1 });
      return;
    }
    drafts.push({
      ...current,
      questionType: "short_answer",
      score: current.score ?? 1,
      shortAnswers: current.shortAnswers ?? []
    });
  }

  for (const rawLine of lines) {
    let line = rawLine;
    const imageMatch = line.match(/^\[\[IMAGE:([^|]+)\|([^\]]*)\]\]$/);
    if (imageMatch) {
      const media = { mediaPath: imageMatch[1], mediaPreview: imageMatch[2] || null };
      if (current) Object.assign(current, media);
      else pendingMedia = media;
      continue;
    }

    line = line.replace(/^soal\s+\d+\s*[-:]\s*/i, "");
    if (!line || isInstruction(line)) continue;
    const scoreLine = readScore(line);
    if (typeof scoreLine.score === "number" && current) current.score = scoreLine.score;
    line = scoreLine.line;
    if (!line) continue;
    if (collectGlobalKeys(line)) continue;
    if (/^\d{1,3}$/.test(line) && globalKeys.has(Number(line))) continue;
    if (/^[A-E]$/i.test(line) && [...globalKeys.values()].includes(line.toUpperCase())) continue;

    const keyMatch = line.match(/^(kunci|jawaban)\s*:\s*(.+)$/i);
    if (keyMatch) {
      const value = keyMatch[2].trim();
      if (collectGlobalKeys(value)) continue;
      if (/^[A-E]$/i.test(value)) {
        currentKey = value.toUpperCase();
      } else if (current) {
        current.shortAnswers = value.split(";").map((answer) => answer.trim()).filter(Boolean);
      }
      continue;
    }

    const numberedQuestion = line.match(/^\d+[\).]\s*(.+)$/);
    if (numberedQuestion) {
      pushCurrent();
      current = {
        questionText: numberedQuestion[1].trim(),
        questionType: "short_answer",
        score: 1,
        ...pendingMedia,
        options: [],
        shortAnswers: [],
        pairs: []
      };
      pendingMedia = {};
      currentKey = "";
      currentNumber = Number(line.match(/^(\d+)/)?.[1] ?? drafts.length + 1);
      continue;
    }

    const optionMatch = line.match(/^([A-E])[\).]\s*(.+)$/i);
    if (optionMatch && current) {
      const optionText = optionMatch[2].trim();
      if (/^(soal\s+pilihan\s+ganda|kunci\s+jawaban)$/i.test(optionText)) continue;
      current.questionType = "multiple_choice";
      current.options = [
        ...(current.options ?? []),
        { label: optionMatch[1].toUpperCase(), text: optionText, isCorrect: false }
      ];
      continue;
    }

    if ((line.includes("|") || line.includes("=")) && current) {
      const [left, right] = line.includes("|") ? line.split("|") : line.split("=");
      if (left?.trim() && right?.trim()) {
        current.questionType = "matching";
        current.pairs = [...(current.pairs ?? []), { left: left.trim(), right: right.trim() }];
      }
      continue;
    }

    if (current) {
      current.questionText = `${current.questionText} ${line}`.trim();
    }
  }

  pushCurrent();

  return drafts.filter((draft) => draft.questionText);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("Upload file Word .docx terlebih dahulu.");
  if (!file.name.toLowerCase().endsWith(".docx")) return jsonError("Saat ini import mendukung file .docx.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        const bytes = Buffer.from(base64, "base64");
        const ext = image.contentType === "image/png" ? "png" : image.contentType === "image/webp" ? "webp" : "jpg";
        const path = `word-import/${crypto.randomUUID()}.${ext}`;
        const upload = await supabaseAdmin.storage.from("question-images").upload(path, bytes, {
          contentType: image.contentType,
          upsert: false
        });
        if (upload.error) return { src: "", "data-preview": `data:${image.contentType};base64,${base64}` };
        const publicUrl = supabaseAdmin.storage.from("question-images").getPublicUrl(path).data.publicUrl;
        return { src: path, "data-preview": publicUrl || `data:${image.contentType};base64,${base64}` };
      })
    }
  );
  const drafts = parseWordText(htmlToText(result.value));

  return NextResponse.json({
    drafts,
    help: {
      multipleChoice: "Soal: ... lalu A. ... B. ... dan Kunci: B",
      shortAnswer: "Soal: ... lalu Jawaban: Bandung; Kota Bandung",
      matching: "Soal: Cocokkan ... lalu Ki Hajar Dewantara | Pendidikan Nasional"
    }
  });
}
