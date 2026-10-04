import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID = "5d88ea9c-c422-4696-88f3-5f2afb315530";

function patch(rel, updater) {
  const file = path.join(ROOT, rel);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  updater(payload);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

const curriculum = {
  framework: "British · Pearson Edexcel IGCSE and A Level",
  medium: "English",
  confidence: "likely",
  stages: [
    {
      id: "preschool",
      name: "Pre-School",
      duration: "Pre-KG and KG",
      source_url: "https://www.helixuniversitycollege.com/wp-content/uploads/2026/05/Pre-School-Pamphlet.pdf",
      source_label: "Official Pre-School pamphlet",
      summary:
        "A May 2026 pamphlet for Helix International Pre-School at No.15(A) Padonmar Street. The Programs page also lists early subjects such as Jolly Phonics, though the Programs intro says academic programmes start at Primary 4.",
      subjects: ["Jolly Phonics", "Alphabets", "Numbers", "Colors", "Shapes", "Science", "Basic mathematics", "Line tracing", "Myanmar language"],
    },
    {
      id: "primary",
      name: "Primary 1 to 6",
      duration: "10 months",
      source_url: "https://www.helixuniversitycollege.com/wp-content/uploads/2026/03/Primary.pdf",
      source_label: "Official Primary pamphlet",
      summary:
        "Primary pamphlet for No.15(D) Padonmar Street. Campus-only subjects: Myanmar Studies, Art and Music, Extra Activity. Online students can transfer to campus by paying the documentation and facility difference.",
      subjects: ["English", "Maths", "Science", "History", "Geography", "Computing", "Myanmar Studies", "Art and Music", "Extra Activity"],
    },
    {
      id: "secondary",
      name: "Secondary",
      source_url: "https://www.helixuniversitycollege.com/wp-content/uploads/2026/03/Secondary.pdf",
      source_label: "Official Secondary pamphlet",
      summary: "Year 7 is listed at Padonmar 15(D). Years 8–9 / Pre-IGCSE are listed at No.301 Shwedagon Pagoda Road.",
      years: [
        {
          name: "Year 7",
          note: "10 months. Myanmar Studies, Art and Music, and Extra Activity are campus only.",
          subjects: ["English", "Mathematics", "Physics", "Chemistry", "Biology", "Computing", "Myanmar Studies", "Art and Music", "Extra Activity"],
        },
        {
          name: "Year 8 and Year 9 · Pre-IGCSE",
          note: "8 months, 301 Campus.",
          subjects: ["English", "Mathematics", "Physics", "Chemistry", "Biology", "Computing", "Business", "Art and Music"],
        },
      ],
    },
    {
      id: "igcse",
      name: "IGCSE",
      duration: "18 to 20 months",
      source_url: "https://www.helixuniversitycollege.com/wp-content/uploads/2026/03/IGCSE.pdf",
      source_label: "Official IGCSE pamphlet",
      summary:
        "Edexcel International GCSE at Manawhari Campus. About names Helix as Edexcel Approved Centre No. 94981, partnered with British Council Yangon. Pearson World First and Country First awards are claimed on the Programs page.",
      subjects: [
        "English Language B",
        "ESL",
        "Mathematics B",
        "Further Pure Maths",
        "Physics",
        "Chemistry",
        "Biology",
        "Human Biology",
        "Accounting",
        "Business",
        "Economics",
        "ICT",
        "Computer Science",
      ],
      notes: [
        "Programs page groups IGCSE into Social Science; Engineering and Technology; Business, Maths and Computer Science; and Health and Science streams.",
      ],
    },
    {
      id: "sixth",
      name: "A Level",
      duration: "18 to 20 months",
      source_url: "https://www.helixuniversitycollege.com/wp-content/uploads/2026/03/A-Level.pdf",
      source_label: "Official A Level pamphlet",
      summary: "A Level pamphlet at Manawhari Campus. Subjects listed: Mathematics, Physics, Chemistry, Biology, and IT.",
      subjects: ["Mathematics", "Physics", "Chemistry", "Biology", "IT"],
    },
    {
      id: "ossd",
      name: "OSSD",
      source_url: "https://www.helixuniversitycollege.com/programs/",
      source_label: "Official website — Programs",
      summary:
        "Programs links an OSSD pamphlet (May 2026). A news post says community activity is required for the Ontario Secondary School Diploma. The pamphlet text was not extracted in this pass, so no subject list is shown.",
      notes: ["Pamphlet: https://www.helixuniversitycollege.com/wp-content/uploads/2026/05/OSSD_Pamphlet.pdf"],
    },
  ],
};

const cca = {
  source_url: "https://www.helixuniversitycollege.com/student-life/",
  source_label: "Official website — Student Life",
  confidence: "likely",
  summary:
    "Student Life lists clubs and sports. The page does not say which of the six Dagon campuses runs each activity. Online students are also invited to clubs, parties, and day trips.",
  groups: [
    {
      id: "clubs",
      name: "Clubs and activities",
      items: [
        "Debate and public speaking",
        "Coding club",
        "Video project contests",
        "Excursions and day trips",
        "Art club",
        "Music club",
        "Student council",
        "Magazine committee",
      ],
    },
    {
      id: "sports",
      name: "Sports",
      items: ["Soccer", "Badminton", "Table tennis", "Chess"],
    },
  ],
};

const facilities = {
  source_url: "https://www.helixuniversitycollege.com/about-us/",
  source_label: "Official website — About and Student Life",
  confidence: "likely",
  summary:
    "About mentions amenities and double-layered security gates. Student Life names a library and laboratory. Online IGCSE students go to campus for practical experiments. The site does not list rooms per campus.",
  groups: [
    {
      id: "learning",
      name: "Learning resources",
      items: ["Library", "Laboratory", "Daily class recordings for online students"],
    },
    {
      id: "safety",
      name: "Safety",
      items: ["Double-layered security gates"],
    },
  ],
};

const campus = {
  school_name: "Helix International School",
  address: "Six Dagon Township campuses; head contacts use info@helixuniversitycollege.com",
  items: [
    {
      text: "Home page lists six Dagon campuses: Manawhari 9/B, 301 Shwedagon Pagoda Road, 293 Shwedagon Pagoda Road, Padonmar 15-D, Padonmar 15-A, and Pyidaungsu Yeiktha 44.",
      source: "Official website — Home",
    },
    {
      text: "MOE currently lists three Helix rows: Padonmar 15 D, Manawhari 9, and 301 Shwedagon Pagoda Road. 293, Padonmar 15-A, and Pyidaungsu are on the website but not on those three MOE rows.",
      source: "Official website — Home and MOE approve list",
    },
    {
      text: "Programs intro says academic programmes start at Primary 4 through IGCSE. Official 2026 pamphlets also advertise Pre-School, Primary 1–6, Secondary, A Level, and an OSSD pamphlet.",
      source: "Official website — Programs and pamphlets",
    },
    {
      text: "About: Edexcel Approved Centre No. 94981, exams with British Council Yangon. Online courses are offered in all academic programmes.",
      source: "Official website — About",
    },
  ],
};

const summary = {
  school_id: ID,
  summary_text:
    "Helix International School is a Dagon Township British-curriculum group. Official pages name Edexcel IGCSE (centre 94981), A Level, campus and online tracks, and six campus addresses. Current fee amounts come from 2026 programme pamphlets, not a single website table.",
  key_stats: [
    { label: "Curriculum", value: "British · Edexcel IGCSE and A Level" },
    { label: "Exam centre", value: "Edexcel 94981, British Council Yangon" },
    { label: "Campuses", value: "Six Dagon addresses on the official site" },
    { label: "Study mode", value: "On campus and online" },
    { label: "Location", value: "Dagon Township, Yangon" },
  ],
  things_to_verify: [
    {
      category: "curriculum",
      confidence_label: "conflicting",
      reconciliation_note:
        "The Programs page says programmes start at Primary 4. Official pamphlets advertise Pre-School and Primary 1–6.",
    },
    {
      category: "campus",
      confidence_label: "conflicting",
      reconciliation_note:
        "The official home page lists six Dagon campuses. The MOE approve list currently has three Helix rows.",
    },
  ],
};

const fees = {
  school_name: "Helix International School",
  posters: [
    {
      source_url: "https://www.helixuniversitycollege.com/programs/",
      source_label: "Official 2026 programme pamphlets",
      label: "Helix campus and online fees",
      kicker: "Official pamphlets",
      confidence: "likely",
      default_branch: "padonmar-1",
      lead: "Amounts below are from official 2026 pamphlets linked on the Programs page. The website HTML does not publish a fee table.",
      notes: [
        "Sibling discount: 5% second child, 10% third child. Uniform and ferry are extra.",
        "Registration is described as one-time. Transfer from online to campus requires paying the documentation and facility difference.",
        "IGCSE pamphlet cells are partly unclear; only the readable registration and monthly figures are shown.",
      ],
      shared: [
        { item: "Sibling discount", amount: "5% second child · 10% third child" },
      ],
      branches: [
        {
          id: "padonmar-2",
          name: "Padonmar Campus-2 · Pre-School",
          address: "No.15(A), Padonmar Street, Dagon Township, Yangon",
          moe_match: ["ပဒုမ္မာ"],
          one_time: [{ item: "Registration", amount: "MMK 300,000" }],
          programmes: [
            { item: "Pre-KG / KG school fee", amount: "MMK 1,800,000 per 3 months" },
            { item: "Material", amount: "MMK 180,000 per 3 months" },
          ],
        },
        {
          id: "padonmar-1",
          name: "Padonmar Campus-1 · Primary and Year 7",
          address: "No.15(D), Padonmar Street, Dagon Township, Yangon",
          moe_match: ["၁၅ D", "ပဒုမ္မာ"],
          one_time: [
            { item: "Registration", amount: "MMK 300,000" },
            { item: "Documentation · campus", amount: "MMK 600,000" },
            { item: "Documentation · online", amount: "MMK 300,000" },
          ],
          programmes: [
            { item: "Primary 1–6 monthly", on_campus: "MMK 750,000", online: "MMK 550,000" },
            { item: "Primary 1–6 yearly (10 months)", on_campus: "MMK 6,750,000", online: "MMK 5,000,000" },
            { item: "Year 7 monthly", on_campus: "MMK 750,000", online: "MMK 550,000" },
            { item: "Year 7 yearly (10 months)", on_campus: "MMK 6,750,000", online: "MMK 5,000,000" },
            { item: "Annual material / facilities (campus)", amount: "USD 500" },
          ],
        },
        {
          id: "campus-301",
          name: "301 Campus · Year 8–9",
          address: "No.301, Shwedagon Pagoda Road, Dagon Township, Yangon",
          moe_match: ["၃၀၁", "ရွှေတိဂုံ"],
          one_time: [
            { item: "Registration", amount: "MMK 300,000" },
            { item: "Documentation · campus", amount: "MMK 600,000" },
            { item: "Documentation · online", amount: "MMK 400,000" },
          ],
          programmes: [
            { item: "Year 8–9 / Pre-IGCSE monthly (8 months)", on_campus: "MMK 750,000", online: "MMK 550,000" },
            { item: "Year 8–9 yearly", on_campus: "MMK 5,580,000", online: "MMK 4,092,000" },
            { item: "Annual material / facilities (campus)", amount: "MMK 500,000" },
          ],
        },
        {
          id: "manawhari",
          name: "Manawhari · IGCSE and A Level",
          address: "No.9(B), Manawhari Street, Dagon Township, Yangon",
          moe_match: ["မနော်ဟရီ", "၉"],
          one_time: [
            { item: "Registration", amount: "MMK 300,000" },
            { item: "A Level material and documentation", amount: "MMK 200,000" },
          ],
          programmes: [
            { item: "IGCSE monthly (18–20 months)", on_campus: "MMK 150,000", online: "MMK 120,000", detail: "Pamphlet layout is per subject; 10% off is mentioned" },
            { item: "A Level monthly", amount: "MMK 220,000" },
            { item: "A Level monthly · Maths", amount: "MMK 270,000" },
          ],
        },
        {
          id: "campus-293",
          name: "293 Campus",
          address: "No.293, Shwedagon Pagoda Road, Dagon Township, Yangon",
          moe_match: ["ရွှေတိဂုံ"],
          programmes: [{ item: "Tuition", detail: "No fee pamphlet for this campus on the Programs page." }],
        },
        {
          id: "pyidaungsu",
          name: "Pyidaungsu Campus",
          address: "No.44, Pyidaungsu Yeiktha Street, Dagon Township, Yangon",
          programmes: [{ item: "Tuition", detail: "No fee pamphlet for this campus on the Programs page." }],
        },
      ],
    },
  ],
};

patch("web/public/school-curriculum/by-school.json", (payload) => {
  payload[ID] = curriculum;
});
patch("web/public/school-cca/by-school.json", (payload) => {
  payload[ID] = cca;
});
patch("web/public/school-facilities/by-school.json", (payload) => {
  payload[ID] = facilities;
});
patch("web/public/school-campus/by-school.json", (payload) => {
  payload[ID] = campus;
});
patch("web/public/school-fees/by-school.json", (payload) => {
  payload[ID] = fees;
});

const registerPath = path.join(ROOT, "web/public/demo-register/schools.json");
const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
register.schools = register.schools.map((school) => {
  if (school.id !== ID) return school;
  return {
    ...school,
    address: "No.15(D), Padonmar Street, Dagon Township, Yangon",
    curriculum_type: "British · Pearson Edexcel IGCSE and A Level",
  };
});
fs.writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);

const summaryPath = path.join(ROOT, "web/public/school-summaries", `${ID}.json`);
fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

const mediaPath = path.join(ROOT, "web/public/school-media", `${ID}.json`);
fs.mkdirSync(path.dirname(mediaPath), { recursive: true });
fs.writeFileSync(
  mediaPath,
  `${JSON.stringify(
    {
      items: [
        {
          kind: "video",
          url: "https://www.youtube.com/watch?v=m5krXnq9eEU",
          embed: "https://www.youtube.com/embed/m5krXnq9eEU",
          thumb: "https://img.youtube.com/vi/m5krXnq9eEU/hqdefault.jpg",
          source: "Official website — Home",
        },
        {
          kind: "video",
          url: "https://www.youtube.com/watch?v=1acbZGd9_Fg",
          embed: "https://www.youtube.com/embed/1acbZGd9_Fg",
          thumb: "https://img.youtube.com/vi/1acbZGd9_Fg/hqdefault.jpg",
          source: "Official website — Secondary 2 chemistry practical",
        },
      ],
    },
    null,
    2,
  )}\n`,
);

console.log("updated Helix official overlays");
