import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID = "ba3c6f02-961b-42e1-8ef9-21d872abbda7";

function patch(rel, updater) {
  const file = path.join(ROOT, rel);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  updater(payload);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

const programmes = [
  { item: "Nursery", amount: "MMK 19,250,000 / year from 1 June" },
  { item: "Year 10", amount: "MMK 30,800,000 / year from 1 June" },
  { item: "Year 11", amount: "MMK 23,100,000 / year from 1 June" },
];

const branches = [
  {
    id: "thuwunna",
    name: "Thuwunna",
    address: "No. (6/A), Kyoe Sett Yone Street, B Quarter, Thuwunna, Thingangyun, Yangon",
    moe_match: ["သင်္ဃန်းကျွန်း", "သုဝဏ္ဏ", "ကြိုးစက်"],
    programmes,
  },
  {
    id: "star-city",
    name: "Star City",
    address: "No.1/B, Plot No.2, Star City, Thanlyin Township, Yangon",
    moe_match: ["သန်လျင်", "Star City"],
    programmes,
  },
  {
    id: "pun-hlaing",
    name: "Pun Hlaing",
    address: "Pun Hlaing Estate Avenue, Hlaing Tharyar Township, Yangon",
    moe_match: ["ပန်းလှိုင်", "လှိုင်သာယာ"],
    programmes,
  },
  {
    id: "golden-valley",
    name: "Golden Valley",
    address: "No.43 Golden Valley Road, Yangon",
    moe_match: ["အင်းယားမြိုင်", "ဗဟန်း", "Golden Valley"],
    programmes,
  },
  {
    id: "kic-bahan",
    name: "KIC Bahan",
    address: "Bahan, downtown Yangon (college campus). Contact page currently repeats the Taunggyi address.",
    moe_match: ["ရွှေဂုံတိုင်", "ဗဟန်း"],
    programmes,
  },
  {
    id: "taunggyi",
    name: "Taunggyi",
    address: "No. (70/10), Haw Sandar Road, Yay Aye Ward, Taunggyi, Shan State",
    moe_match: ["တောင်ကြီး", "ဟော်စန္ဒာ"],
    programmes,
  },
];

const curriculum = {
  framework: "Cambridge and Pearson Edexcel",
  medium: "English, with Myanmar and Chinese",
  confidence: "likely",
  stages: [
    {
      id: "preschool",
      name: "Preschool",
      ages: "2 to 5",
      duration: "Pre-Nursery, Nursery, Reception",
      source_url: "https://www.kis-mm.com/preschool",
      source_label: "Official website — Preschool",
      summary:
        "UK EYFS. The page says eight developmental areas and then lists seven. Daily English, Mandarin, and Myanmar. Forest School outdoor learning.",
      subjects: [
        "Personal and Social Development",
        "Physical Development",
        "Communication and Language",
        "Literacy",
        "Understanding the World",
        "Numeracy",
        "Creative Development",
      ],
      notes: [
        "Groups: Pre-Nursery ages 2–3, Nursery 3–4, Reception 4–5.",
        "Golden Valley preschool page also names Pre-Nursery to Reception and nature play.",
      ],
    },
    {
      id: "primary",
      name: "Primary",
      duration: "Year 1 to Year 6",
      source_url: "https://www.kis-mm.com/primary",
      source_label: "Official website — Primary",
      summary:
        "The group Primary page says students sit Pearson Edexcel iPrimary at the end of Year 6, in a trilingual English / Myanmar / Chinese setting. Star City and Thuwunna pages instead emphasise Cambridge Checkpoint in Year 6.",
      subjects: [
        "English",
        "Mathematics",
        "Science",
        "STEM",
        "Art",
        "Music",
        "Physical Education",
        "ICT",
        "History",
        "Geography",
        "Library",
        "Myanmar",
        "Chinese",
      ],
      notes: [
        "HSK Chinese exams are optional.",
        "Thuwunna Primary calls the school Cambridge accredited and cites 2024–25 CIE Primary Checkpoint results.",
      ],
    },
    {
      id: "secondary",
      name: "Lower Secondary",
      duration: "Year 7 to Year 9",
      source_url: "https://www.kis-mm.com/lower-secondary",
      source_label: "Official website — Lower Secondary",
      summary:
        "The group page says students sit Pearson Edexcel iSecondary at the end of Year 9. Star City names Cambridge Checkpoint in Year 9. Thuwunna Secondary says Years 7–9 prepare for Cambridge IGCSE.",
      subjects: [
        "English",
        "Mathematics",
        "Science",
        "STEM",
        "Art",
        "Music",
        "ICT",
        "History",
        "Geography",
        "Literature",
        "Myanmar",
        "Chinese",
      ],
      notes: ["Pun Hlaing says Cambridge British international curriculum from Early Years to Lower Secondary. Taunggyi offers Nursery to Year 8."],
    },
    {
      id: "igcse",
      name: "Upper Secondary · IGCSE",
      duration: "Year 10 and Year 11",
      source_url: "https://www.kis-mm.com/upper-secondary",
      source_label: "Official website — Upper Secondary",
      summary:
        "The group IGCSE page offers both Edexcel and Cambridge. Thuwunna Secondary describes a two-year Cambridge IGCSE programme and publishes May/June 2025 results of 78% A*–A.",
      years: [
        {
          name: "IGCSE subjects named on the group page",
          subjects: [
            "English",
            "Mathematics",
            "Further Mathematics",
            "Physics",
            "Chemistry",
            "Biology",
            "Economics",
            "Business Studies",
            "ICT",
            "Accounting",
            "Chinese",
          ],
        },
        {
          name: "Thuwunna Secondary IGCSE suite",
          note: "Named on the Thuwunna Secondary page.",
          subjects: [
            "First Language English",
            "English as a Second Language",
            "Extended Mathematics",
            "Additional Mathematics",
            "Physics",
            "Chemistry",
            "Biology",
            "Business",
            "Economics",
            "Accounting",
            "ICT",
            "Computer Science",
          ],
        },
      ],
      notes: ["Thuwunna Secondary says scholarships cover 10% of students from Years 9 to 11, on academic merit and need."],
    },
    {
      id: "sixth",
      name: "Pre-university · KIC Bahan",
      source_url: "https://www.kis-mm.com/bahancollege",
      source_label: "Official website — KIC Bahan",
      summary:
        "KINGS International College Bahan offers NCUK International Foundation Year and Pearson Edexcel A Levels. The home page also names overseas-education advisory services.",
      years: [
        {
          name: "NCUK IFY",
          note: "9 months from September or 7 months from January. Entry: high school or equivalent, IELTS 5.0 or equivalent, reference and interview.",
          subjects: ["Academic English", "Subject modules", "University application support"],
        },
        {
          name: "Pearson Edexcel A Levels",
          note: "Two years, typically 3–4 subjects. Entry: strong secondary record, IELTS 5.5 or equivalent, interview and assessment. The page does not list the subject menu.",
          subjects: ["A Level subjects (menu not published on this page)"],
        },
      ],
    },
  ],
};

const cca = {
  source_url: "https://www.kis-mm.com/goldenvalley",
  source_label: "Official website — campus pages",
  confidence: "likely",
  summary:
    "ECA lists are campus-specific. Golden Valley, Star City, and Thuwunna Secondary publish different activities. The site does not publish one group-wide CCA timetable.",
  groups: [
    {
      id: "golden-valley",
      name: "Golden Valley ECAs",
      items: [
        "Presentation Master",
        "Little Chef",
        "Young Scientist",
        "Karate",
        "Arts and crafts",
        "Dance",
        "Team projects",
        "PE",
        "STEAM",
        "Music",
        "Computing",
        "Homework Club",
      ],
    },
    {
      id: "star-city",
      name: "Star City enrichment",
      items: [
        "Robotic STEM",
        "Spelling Bee",
        "Math, Computing, Myanmar and Chinese competitions",
        "STEAM and Robotics fairs",
        "Sports Day",
        "Field trips",
        "Weekly assemblies",
      ],
    },
    {
      id: "thuwunna-secondary",
      name: "Thuwunna Secondary",
      items: [
        "Sports programmes",
        "Student Council and House Captains (five houses)",
        "Podcasting",
        "Newsletter team",
        "AI Club",
        "Content creation",
        "Community service",
      ],
    },
    {
      id: "taunggyi",
      name: "Taunggyi",
      items: ["Art", "Music", "Dance", "Sports", "Simple engineering projects"],
    },
  ],
};

const facilities = {
  source_url: "https://www.kis-mm.com/starcity",
  source_label: "Official website — campus pages",
  confidence: "likely",
  summary: "Facilities are listed per campus. The official site does not publish one inventory for all six branches.",
  notes: [
    "Thuwunna is described as three purpose-built buildings from Nursery to Key Stage 4.",
    "Contact Us currently copies the Taunggyi address onto KINGS College. The Bahan college page says downtown Yangon.",
  ],
  groups: [
    {
      id: "star-city",
      name: "Star City",
      items: [
        "19 modern classrooms and extended Lower Secondary spaces",
        "Multi-court",
        "Computing room",
        "Science lab",
        "Music room",
        "New library",
        "Preschool playground",
        "Spacious parking",
        "Solar-powered facilities",
      ],
    },
    {
      id: "pun-hlaing",
      name: "Pun Hlaing",
      items: ["Spacious classrooms", "Specialist rooms", "Natural grass football pitch", "Outdoor learning spaces"],
    },
    {
      id: "golden-valley",
      name: "Golden Valley",
      items: ["Bamboo-structured campus", "Nature play / outdoor preschool", "Homework Club space"],
    },
    {
      id: "kic-bahan",
      name: "KIC Bahan",
      items: [
        "Air-conditioned classrooms with smart boards",
        "Library for A Level and NCUK",
        "Science laboratory (Physics, Chemistry, Biology)",
        "Student lounge",
        "Indoor and outdoor sports including table tennis",
        "Student support and counselling centre",
        "24-hour security and CCTV",
      ],
    },
    {
      id: "taunggyi",
      name: "Taunggyi",
      items: ["Spacious grassy playground"],
    },
  ],
};

const campus = {
  school_name: "Kings International School",
  address: "Head office: No. (6/A), Kyoe Sett Yone Street, B Quarter, Thuwunna, Thingangyun, Yangon",
  items: [
    {
      text: "Home page: established 2009, six branches, preschool to IGCSE, NCUK IFY, A Levels, and overseas-education advice.",
      source: "Official website — Home",
    },
    {
      text: "Campuses named on the home page: Pun Hlaing, Star City, Golden Valley, Taunggyi, Thuwunna, and KIC Bahan.",
      source: "Official website — Home",
    },
    {
      text: "Thuwunna is the largest campus: three buildings, Nursery to Key Stage 4, head office at No. (6/A), Kyoe Sett Yone Street, Thingangyun.",
      source: "Official website — Thuwunna Primary and Contact",
    },
    {
      text: "Star City: Preschool to Lower Secondary, Cambridge Curriculum, class size 20–25, enrolment from under 100 in 2023–24 to over 200 in 2025–26. Address No.1/B, Plot No.2, Star City, Thanlyin.",
      source: "Official website — Star City and Contact",
    },
    {
      text: "Pun Hlaing: Cambridge British international curriculum from Early Years to Lower Secondary, next to Pun Hlaing Estate, Hlaing Tharyar.",
      source: "Official website — Pun Hlaing and Contact",
    },
    {
      text: "Golden Valley: bamboo campus and EYFS preschool. Contact lists No.43 Golden Valley Road. MOE lists No.43 Inya Myaing Road, Bahan.",
      source: "Official website — Golden Valley / Contact and MOE",
    },
    {
      text: "Taunggyi: Nursery to Year 8, No. (70/10) Haw Sandar Road. The Contact page repeats this address under KINGS College.",
      source: "Official website — Taunggyi and Contact",
    },
    {
      text: "KIC Bahan: NCUK IFY and Pearson Edexcel A Levels at a downtown Yangon college campus. MOE has a separate Bahan row at No.15 Shwe Gon Taing 4th Street.",
      source: "Official website — KIC Bahan and MOE",
    },
  ],
};

const summary = {
  school_id: ID,
  summary_text:
    "KINGS International School is a 2009 British-curriculum group with six campuses. Official pages name EYFS through IGCSE, plus NCUK IFY and Pearson Edexcel A Levels at KIC Bahan. The live website does not publish current fee amounts.",
  key_stats: [
    { label: "Curriculum", value: "Cambridge and Pearson Edexcel, preschool to pre-university" },
    { label: "Campuses", value: "Six: Thuwunna, Star City, Pun Hlaing, Golden Valley, KIC Bahan, Taunggyi" },
    { label: "Class size", value: "20–25 at Star City" },
    { label: "IGCSE 2025", value: "78% A*–A at Thuwunna Secondary (May/June 2025)" },
    { label: "Location", value: "Head office Thuwunna, Thingangyun" },
  ],
  things_to_verify: [
    {
      category: "curriculum",
      confidence_label: "conflicting",
      reconciliation_note:
        "Group Primary and Lower Secondary pages name Pearson Edexcel iPrimary / iSecondary. Star City and Thuwunna pages emphasise Cambridge Checkpoint and Cambridge IGCSE.",
    },
    {
      category: "location",
      confidence_label: "conflicting",
      reconciliation_note:
        "Contact lists KINGS College at the Taunggyi Haw Sandar address. The Bahan college page says downtown Yangon. Golden Valley is No.43 Golden Valley Road on Contact and No.43 Inya Myaing Road, Bahan on the MOE list.",
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
  payload[ID] = {
    school_name: "Kings International School",
    posters: [
      {
        file: "Kings INternational School.jpg",
        source_url: "https://www.kis-mm.com/admission-inquiry",
        source_label: "Posted 2026–2027 table · official site has no amounts",
        label: "KINGS International School 2026–2027",
        kicker: "Group poster",
        confidence: "likely",
        default_branch: "star-city",
        lead: "The live kis-mm.com pages do not publish tuition amounts. Figures below come from a 2026–2027 admissions poster that names six campuses.",
        notes: [
          "Re-enrolment deposit MMK 1,500,000 by 30 March 2026; credited to next-year fees, not refundable.",
          "Early-bird rebate: MMK 600,000 annual or MMK 300,000 termly if paid by 30 March 2026.",
          "Campus addresses are from the official Contact page. Amounts are group-wide on the poster, not a per-campus table.",
        ],
        shared: [{ item: "Re-enrolment deposit", amount: "MMK 1,500,000 by 30 March 2026" }],
        branches,
      },
    ],
  };
});

const registerPath = path.join(ROOT, "web/public/demo-register/schools.json");
const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
register.schools = register.schools.map((school) => {
  if (school.id !== ID) return school;
  return {
    ...school,
    address: "No. (6/A), Kyoe Sett Yone Street, B Quarter, Thuwunna, Thingangyun, Yangon",
    curriculum_type: "Cambridge and Pearson Edexcel",
    official_facebook_url: school.official_facebook_url || "https://www.facebook.com/kismm.edu",
  };
});
fs.writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);

const summaryPath = path.join(ROOT, "web/public/school-summaries", `${ID}.json`);
fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log("updated Kings International official overlays");
