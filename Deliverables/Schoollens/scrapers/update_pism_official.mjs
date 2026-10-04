import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID = "d1e8deee-ed2c-43fb-a382-c3adb5d06861";

function patch(rel, updater) {
  const file = path.join(ROOT, rel);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  updater(payload);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

const curriculum = {
  framework: "Cambridge / British National Curriculum",
  medium: "English",
  academic_year: "Late August to June",
  confidence: "likely",
  stages: [
    {
      id: "preschool",
      name: "Early Years Foundation Stage",
      ages: "2.5 to 5",
      duration: "Pre-Nursery, Nursery, Kindergarten",
      source_url: "https://pismmyanmar.com/index.php/early-years-foundation-stage/curriculum",
      source_label: "Official website — EYFS curriculum",
      summary:
        "PISM follows the statutory EYFS framework. Seven areas of learning: three prime and four specific. Nursery uses Letters and Sounds Phase 1; Kindergarten moves to Phase 2 and 3 phonics.",
      subjects: [
        "Communication and Language",
        "Physical Development",
        "Personal, Social and Emotional Development",
        "Literacy",
        "Mathematics",
        "Understanding the World",
        "Expressive Arts and Design",
      ],
      hours: ["EYFS day: 9:00 a.m. to 3:00 p.m., with nap time 1:10 p.m. to 3:00 p.m. (FAQ)."],
      notes: [
        "FAQ lists Pre-Nursery, Nursery, and Kindergarten for ages 2.5 to 5.",
        "The page lists Early Learning Goals under each area; those are outcomes, not extra subjects.",
      ],
    },
    {
      id: "primary",
      name: "Primary · Key Stage 1 and 2",
      ages: "5 to 11",
      duration: "Year 1 to Year 6",
      source_url: "https://pismmyanmar.com/index.php/primary-school/curriculum",
      source_label: "Official website — Primary curriculum",
      summary:
        "Cambridge Primary for English, Mathematics, and Science. Other subjects follow the English National Curriculum. Myanmar Language is twice a week.",
      subjects: [
        "English",
        "Mathematics",
        "Science",
        "History",
        "Geography",
        "Myanmar Language",
        "Computing",
        "Music",
        "Art and Design",
        "Physical Education",
        "PSHE",
      ],
      hours: ["Year 1: 9:00 a.m. to 2:00 p.m.", "Year 2 to Year 6: 8:00 a.m. to 2:00 p.m."],
      notes: [
        "Key Stage 2 PE names football, handball, softball, basketball, badminton, table tennis, and karate.",
        "Computing pages mention dedicated computer rooms and e-safety.",
      ],
    },
    {
      id: "secondary",
      name: "Secondary · Key Stage 3",
      duration: "Year 7 to Year 9",
      source_url: "https://pismmyanmar.com/index.php/secondary-school/curriculum",
      source_label: "Official website — Secondary curriculum",
      summary:
        "Ten compulsory subjects: English, Mathematics, and Science as core; ICT, History, Geography, and Myanmar Studies as main; Art and Design, PE, and Music as enhancement. English follows Cambridge English as a Second Language for lower secondary.",
      hours: ["Year 7 to Year 10: 9:00 a.m. to 3:00 p.m."],
      years: [
        {
          name: "Key Stage 3",
          subjects: [
            "English",
            "Mathematics",
            "Science",
            "ICT",
            "History",
            "Geography",
            "Myanmar Studies",
            "Art and Design",
            "Physical Education",
            "Music",
          ],
        },
      ],
    },
    {
      id: "igcse",
      name: "IGCSE · Key Stage 4",
      duration: "Year 10 and Year 11",
      source_url: "https://pismmyanmar.com/index.php/secondary-school/curriculum",
      source_label: "Official website — Secondary curriculum",
      summary:
        "The Key Stage 4 page lists Cambridge IGCSE subjects and says some are offered now and some in the near future. About and Secondary overview name a shorter current set.",
      hours: ["Year 11: 8:00 a.m. to 3:00 p.m."],
      years: [
        {
          name: "Key Stage 4",
          note: "Curriculum page list. About currently names ESL, Maths, Additional Maths, Physics, Chemistry, Biology, Business Studies, History, and ICT.",
          subjects: [
            "First Language English (0500)",
            "English as a Second Language (0510 / 0511)",
            "Mathematics (0580)",
            "Additional Mathematics (0606)",
            "Biology (0610)",
            "Chemistry (0620)",
            "Physics (0625)",
            "ICT (0417)",
            "Computer Science (0478)",
            "Business Studies (0450)",
            "Accounting (0452)",
            "Art and Design (0400)",
            "Global Perspectives (0457)",
          ],
        },
      ],
      notes: [
        "FAQ: Year 11 students can sit IGCSE at PISM as a CAIE exam centre.",
        "Secondary overview also names Economics and says History, Geography, Human Biology, and World Literature are planned as later options.",
      ],
    },
    {
      id: "sixth",
      name: "AS / A Level · Key Stage 5",
      duration: "Year 12 and Year 13",
      source_url: "https://pismmyanmar.com/index.php/secondary-school",
      source_label: "Official website — Secondary overview",
      summary:
        "After IGCSE the Secondary overview says PISM offers GCE A Levels in Mathematics, Physics, and Chemistry, plus IELTS for English-language university entry.",
      subjects: ["Mathematics", "Physics", "Chemistry"],
      notes: ["FAQ lists AS/A Level as Key Stage 5, Years 12 and 13. The curriculum page does not publish a full A Level subject table."],
    },
  ],
};

const cca = {
  source_url: "https://pismmyanmar.com/index.php/primary-school/eca",
  source_label: "Official website — ECA",
  confidence: "likely",
  summary:
    "Primary and Secondary ECA pages describe after-school programmes starting in September. Both published schedules are labelled Academic Year 2023–2024. Mandalay lists a separate Enrichment Programme.",
  groups: [
    {
      id: "primary",
      name: "Primary ECA 2023–2024",
      items: [
        "Art and design / arts and crafts",
        "Badminton",
        "Basketball",
        "Football",
        "Table tennis",
        "Gymnastics",
        "Karate",
        "Chess",
        "Drama club",
        "Dancing club / Myanmar dance",
        "Piano",
        "Guitar",
        "Violin",
        "Ukulele",
        "Singing",
        "Fun with Maths",
      ],
    },
    {
      id: "secondary",
      name: "Secondary ECA 2023–2024",
      items: [
        "Badminton",
        "Table tennis",
        "Football",
        "Basketball",
        "Chess",
        "Drama club",
        "Dancing club",
        "Arts and crafts",
        "Piano",
        "Violin",
        "Guitar",
        "Fun with Maths",
      ],
    },
    {
      id: "mandalay",
      name: "Mandalay Enrichment Programme",
      items: [
        "Art — painting",
        "Art — needlework",
        "Badminton",
        "Football",
        "Table tennis",
        "Chess",
        "Piano",
        "Guitar",
        "Beginner’s French",
        "German",
        "Chinese",
        "Core-subject support",
        "Extra IGCSE ICT option",
      ],
    },
  ],
};

const facilities = {
  source_url: "https://pismmyanmar.com/index.php/secondary-school",
  source_label: "Official website — Secondary and Mandalay overview",
  confidence: "likely",
  summary:
    "Yangon Secondary describes a newer building. Mandalay lists rooms on its overview page. The site does not publish a single facilities list for every Yangon campus.",
  notes: [
    "Primary curriculum mentions well-resourced computer rooms. Contact Us on the official site is a placeholder address and was not used.",
  ],
  groups: [
    {
      id: "yangon-secondary",
      name: "Yangon Secondary building",
      items: [
        "Two science labs",
        "Music rooms",
        "Computer lab",
        "Dance and drama studio",
        "Art room",
        "Outdoor recreation area",
        "Roof garden",
      ],
    },
    {
      id: "mandalay",
      name: "Mandalay campus",
      items: [
        "22 general teaching rooms",
        "Three libraries",
        "ICT suite",
        "Art and Design studio",
        "Music room",
        "Science lab",
        "Sports hall",
        "Multi-purpose hall",
        "Small recreational pitch",
        "Small swimming pool",
      ],
    },
  ],
};

const campus = {
  school_name: "Pride ISM Pride International School Myanmar",
  address: "Aung Chan Thar 4th Street, Aung Myay Thar Zi, Kamayut, Yangon, Myanmar",
  items: [
    {
      text: "About says Pride ISM opened in Yangon in 2001–2002 and now has four campuses: Early Years, Primary, and Secondary in Yangon, plus a Mandalay sister campus from March 2005.",
      source: "Official website — About",
    },
    {
      text: "The About overview also says three campuses: Early Years, a combined Primary and Secondary site in Yangon, and Mandalay. Those two official counts do not match.",
      source: "Official website — About overview",
    },
    {
      text: "Admissions says the school has provided education for more than 14 years and currently serves about 1,200 students. Office hours: 7:30 a.m.–4:00 p.m. in term time.",
      source: "Official website — Admissions",
    },
    {
      text: "School year is about 184 teaching days from late August to June. About sets class size at 24 maximum; FAQ sets maximum class size at 25.",
      source: "Official website — About and FAQ",
    },
    {
      text: "Mandalay overview: Pre-Nursery through Secondary, more than 200 students, same EYFS and Key Stage 1–3 programme as Yangon, 09:00–15:00, 185 teaching days, class size 24.",
      source: "Official website — Mandalay overview",
    },
    {
      text: "MOE lists two separate Pride ISM rows: Kamayut, Yangon, and Chanmyathazi, Mandalay, both 2024–2025 to 2028–2029.",
      source: "MOE approve list",
    },
  ],
};

const summary = {
  school_id: ID,
  summary_text:
    "Pride International School Myanmar is a Cambridge-registered British-curriculum school. Official pages list Early Years through AS/A Level, about 1,200 students, Yangon plus Mandalay, and IGCSE as a CAIE exam centre.",
  key_stats: [
    { label: "Curriculum", value: "Cambridge / British National, EYFS to AS/A Level" },
    { label: "Students", value: "About 1,200 (Admissions page)" },
    { label: "Class size", value: "24 on About; 25 maximum on FAQ" },
    { label: "Academic year", value: "Late August to June, about 184 days" },
    { label: "Location", value: "Yangon campuses plus Mandalay (2005)" },
  ],
  things_to_verify: [
    {
      category: "class size",
      confidence_label: "conflicting",
      reconciliation_note:
        "About and Mandalay overview say class size is set at 24 maximum. FAQ says the maximum class size is 25 students.",
    },
    {
      category: "campus",
      confidence_label: "conflicting",
      reconciliation_note:
        "About says four campuses (EYFS, Primary, Secondary, plus Mandalay). About overview says three campuses (EYFS, Primary and Secondary in Yangon, and Mandalay).",
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
  const current = payload[ID] || { school_name: "Pride ISM Pride International School Myanmar", posters: [] };
  current.posters = (current.posters || []).map((poster, index) => {
    if (index !== 0) return poster;
    return {
      ...poster,
      source_url: "https://pismmyanmar.com/index.php/information/admissions",
      source_label: "Posted Year 2 table · official Admissions page has no amounts",
      kicker: "2025–2026 poster",
      confidence: "likely",
      lead: "The live Admissions page discusses tuition and transport but does not publish current fee amounts. Year 2 figures below come from a posted announcement.",
      notes: [
        "Official Admissions: apply year-round; placement test in English and Mathematics; registration and placement-test fees are not refundable (FAQ).",
        "2023 parent-student handbook: fees paid after admission are due in full within 7 days; later instalments have set dates; unpaid fees can block class and exams. That handbook does not replace a current fee table.",
        "Contact Us on pismmyanmar.com is a dummy address and was ignored.",
      ],
    };
  });
  payload[ID] = current;
});

const summaryPath = path.join(ROOT, "web/public/school-summaries", `${ID}.json`);
fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log("updated PISM official overlays");
