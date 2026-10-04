import fs from "fs";
import path from "path";

const csvPath =
  "D:/SMT/Personal/myPKA-main/myPKA-main/Owner Inbox/App/School Data/MOE_Approve_School_List.csv";
const registerPath =
  "D:/SMT/Personal/myPKA-main/myPKA-main/Deliverables/Schoollens/web/public/demo-register/schools.json";
const outPath =
  "D:/SMT/Personal/myPKA-main/myPKA-main/Deliverables/Schoollens/web/public/moe-register/by-school.json";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function compact(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function latin(value) {
  const digits = "0123456789";
  const myanmar = "၀၁၂၃၄၅၆၇၈၉";
  return String(value || "")
    .replace(/[၀-၉]/g, (ch) => digits[myanmar.indexOf(ch)] ?? ch)
    .replace(/\s+/g, " ")
    .trim();
}

function periodLabel(value) {
  const text = latin(value).replace(/မှ/g, " to ").replace(/-+/g, "-");
  const years = text.match(/20\d{2}/g) || [];
  if (years.length >= 4) return `${years[0]}-${years[1]} to ${years[years.length - 2]}-${years[years.length - 1]}`;
  if (years.length === 3) return `${years[0]}-${years[1]} to ${years[2]}`;
  if (years.length === 2) return `${years[0]}-${years[1]}`;
  return text || null;
}

function approvalDates(value) {
  const years = (latin(value).match(/20\d{2}/g) || []).map(Number);
  if (!years.length) return { from: null, to: null };
  return {
    from: `${Math.min(...years)}-06-01`,
    to: `${Math.max(...years)}-05-31`,
  };
}

function matchSchool(name, website, registerSchools) {
  const key = compact(name).replace("internatioanal", "international");
  const site = String(website || "").toLowerCase();
  if ((key.includes("ilbc") || site.includes("ilbc.edu.mm")) && !key.includes("ilbsm") && !site.includes("ilbsm")) {
    return "f6c7b97d-8959-4d0c-841f-8148d10dcd4d";
  }
  if (key === "theinternationalschoolyangon" || site.includes("isyedu.org")) {
    return "b0595924-73f7-49c4-94b0-b05017d77ef8";
  }
  if (key.includes("myanmarinternationalschoolyangon") || key.includes("misy") || site.includes("misy.edu.mm")) {
    return "6d0e010f-b869-4350-ae90-5a30f531d22d";
  }
  if ((key.includes("yangoninternationalschool") || key.startsWith("yis")) && !key.includes("theinternational")) {
    return "038e4ef9-a8a3-4dca-9ea9-aad223fc71c5";
  }
  if (key.includes("myanmarinternationalschool") && !key.includes("yangon") && !key.includes("pride")) {
    return "4dd4da53-4a6f-4bac-aca9-0fd9955e8bfc";
  }
  if (key.includes("britishschoolyangon")) return "22b3784f-3e04-4153-80e0-abe3000fe273";
  if (key.includes("kingsyangon")) return "3f96414d-5543-45ee-85da-16856c784bbe";
  if (key.includes("kingsinternationalschool") && !key.includes("yangon")) return "ba3c6f02-961b-42e1-8ef9-21d872abbda7";
  if (key.includes("networkinternationalschool")) return "6c78977f-de06-4078-bbd2-570e303276ae";
  if (key.includes("pride")) return "d1e8deee-ed2c-43fb-a382-c3adb5d06861";
  if (key.includes("crane")) return "1254e3cd-5600-4fe5-bc9f-740995cc1f74";
  if (key.includes("alba")) return "d1ba7508-d79b-49a9-99aa-016c0e4a7728";
  if (key.includes("iip")) return "3d1593e7-5f61-4b29-b0ab-c70aab49514f";
  if (key.includes("niec") || key.includes("nelsoninternational")) return "3a7850e4-c67a-4754-8b2f-3e055893f972";
  if (key.includes("helix")) return "5d88ea9c-c422-4696-88f3-5f2afb315530";
  if (key.includes("warriors")) return "9e523ef5-6ea0-42a5-bd93-14346a9afbc8";
  if (key.includes("hallway")) return "ff40e933-2c42-48ab-95d9-73a107d00976";
  if (key.includes("edusn")) return "5d8dba5b-965e-4aad-931c-ab3b0839fff8";
  if (key.includes("iseinternationalschool") || site.includes("ise.com.mm")) return "fc9735e2-9a8f-4e77-8970-c9244283fa18";
  if (key.includes("conceptx")) return "9c5928e5-b6da-4648-bb21-10dea2844346";
  if (key.includes("french") || key.includes("lfir")) return "32c57574-25e9-43ec-82b6-76310ab44bbd";
  if (key.includes("skt") && key.includes("city")) return "26b13622-e17d-5800-9a44-06ded1015b3c";
  if (key.includes("skt") && key.includes("riverside")) return "cf00dc95-940d-507e-988b-916043e530d4";
  const exact = registerSchools.find((school) => compact(school.name).replace("internatioanal", "international") === key);
  if (exact) return exact.id;
  const loose = registerSchools.filter((school) => {
    const schoolKey = compact(school.name).replace("internatioanal", "international");
    return schoolKey.length >= 14 && (key.includes(schoolKey) || schoolKey.includes(key));
  });
  if (loose.length === 1) return loose[0].id;
  return null;
}

const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
const registerSchools = register.schools || [];
const raw = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(raw).slice(1);
const grouped = {};

for (const cols of rows) {
  const name = (cols[1] || "").replace(/\u00a0/g, " ").trim();
  if (!name) continue;
  const address = (cols[2] || "").replace(/\u00a0/g, " ").trim();
  const period = (cols[3] || "").trim();
  const website = (cols[4] || "").trim();
  const schoolId = matchSchool(name, website, registerSchools);
  if (!schoolId) continue;
  const dates = approvalDates(period);
  grouped[schoolId] ??= [];
  grouped[schoolId].push({
    moe_index: cols[0],
    listed_name: name,
    address: address || null,
    period: periodLabel(period),
    moe_approved_from: dates.from,
    moe_approved_to: dates.to,
    official_website_url: website.startsWith("http") ? website : null,
  });
}

const payload = {};
for (const [schoolId, campuses] of Object.entries(grouped)) {
  const fromYears = campuses.map((row) => row.moe_approved_from).filter(Boolean).sort();
  const toYears = campuses.map((row) => row.moe_approved_to).filter(Boolean).sort();
  payload[schoolId] = {
    campus_count: campuses.length,
    moe_approved_from: fromYears[0] || null,
    moe_approved_to: toYears[toYears.length - 1] || null,
    period: campuses.map((row) => row.period).filter(Boolean)[0] || null,
    campuses,
  };
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

register.schools = register.schools.map((school) => {
  const hit = payload[school.id];
  if (!hit) return school;
  return {
    ...school,
    moe_approved_from: hit.moe_approved_from,
    moe_approved_to: hit.moe_approved_to,
    official_website_url: school.official_website_url || hit.campuses.find((row) => row.official_website_url)?.official_website_url || null,
    school_group_id:
      school.id === "f6c7b97d-8959-4d0c-841f-8148d10dcd4d" ? "0f1bc000-0000-4000-8000-000000000001" : school.school_group_id,
  };
});
fs.writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);

console.log(
  Object.entries(payload)
    .map(([id, row]) => `${id.slice(0, 8)} campuses=${row.campus_count} ${row.period}`)
    .join("\n"),
);
console.log("ILBC", payload["f6c7b97d-8959-4d0c-841f-8148d10dcd4d"]?.campus_count);
