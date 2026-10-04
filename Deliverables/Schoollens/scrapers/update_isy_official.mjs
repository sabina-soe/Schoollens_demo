import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID = "b0595924-73f7-49c4-94b0-b05017d77ef8";

function patch(rel, updater) {
  const file = path.join(ROOT, rel);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  updater(payload);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

const curriculum = {
  framework: "U.S. curriculum through Grade 10 · IB Diploma Grades 11–12",
  medium: "English",
  academic_year: "August to June",
  confidence: "likely",
  stages: [
    {
      id: "early-years",
      name: "Early Years · Chinthe Cubs and Kindergarten",
      ages: "3 to 5",
      duration: "Chinthe Cubs 3, Chinthe Cubs 4, Kindergarten",
      source_url: "https://www.isyedu.org/learning/elementary-school",
      source_label: "Official website — Elementary School",
      summary:
        "Elementary includes Chinthe Cubs (ages 3 and 4) and Kindergarten. Early learning is described as a Reggio-inspired environment with play, projects, music, and physical education. Apply says Chinthe Cubs 3, 4, and Kindergarten applicants must be three, four, and five by 31 August.",
      subjects: ["Play-based projects", "Painting and drawing", "Sculpting", "Drama", "Music", "Physical education", "Swimming"],
      notes: [
        "Home and About also call Early Years Chinthe Cubs (ages 3–4) plus Kindergarten.",
        "Apply: Chinthe Cubs and Kindergarten applicants must be toilet trained.",
      ],
    },
    {
      id: "elementary",
      name: "Elementary · Grades 1 to 5",
      ages: "6 to 11",
      duration: "Grades 1 to 5",
      source_url: "https://www.isyedu.org/learning/elementary-school",
      source_label: "Official website — Elementary School",
      summary:
        "U.S. standards-based programme. Common Core for mathematics and English language arts, Next Generation Science Standards, and AERO social studies. Specialists include PE, music, visual arts, library, Myanmar language/history/culture, and world languages.",
      subjects: [
        "English Language Arts",
        "Mathematics",
        "Science",
        "Social Studies",
        "Myanmar Culture, Language, History and Geography",
        "Physical Education",
        "Music",
        "Visual Arts",
        "Library",
        "World Languages (French or Mandarin from Grade 2)",
      ],
      notes: [
        "Myanmar students and international students have separate Myanmar culture/language/history/geography tracks.",
        "World languages begin in Grade 2 for students without native fluency in French or Mandarin.",
        "Swimming is taught year-round in Elementary PE.",
      ],
    },
    {
      id: "middle",
      name: "Middle School · Grades 6 to 8",
      duration: "Grades 6 to 8",
      source_url: "https://www.isyedu.org/learning/middle-school",
      source_label: "Official website — Middle School",
      summary:
        "All Middle School students take a fixed core plus a weekly advisory. Standards are organised as Grade 6 to 10 continuums.",
      subjects: [
        "English Language Arts",
        "Social Studies",
        "Mathematics",
        "Science",
        "World Languages (Mandarin or French)",
        "Myanmar Culture, Language, History, and Geography",
        "Visual Art",
        "Music",
        "Physical Education",
        "Health",
        "Advisory (weekly)",
      ],
    },
    {
      id: "high",
      name: "High School · Grades 9 and 10 (pre-IB)",
      duration: "Grades 9 and 10",
      source_url: "https://www.isyedu.org/learning/high-school",
      source_label: "Official website — High School",
      summary:
        "Grades 9 and 10 are described as the pre-IB years. Students take a U.S. core and must complete one Art and one Technology elective by the end of Grade 10. Electives vary by year.",
      years: [
        {
          name: "Grade 9 core",
          subjects: [
            "English Language Arts",
            "Social Studies",
            "Mathematics",
            "Science",
            "World Languages (Mandarin, French) or Burmese",
            "Physical Education",
            "Health (semester)",
            "Personal Development (quarter)",
            "Service Learning (quarter)",
          ],
        },
        {
          name: "Grade 10 core",
          subjects: [
            "English Language Arts",
            "Social Studies",
            "Mathematics",
            "Science",
            "World Languages (Mandarin, French) or Burmese",
          ],
        },
        {
          name: "Grade 9–10 electives named on the page",
          note: "Offerings vary by student interest and staffing. Students pick in preference order.",
          subjects: [
            "Design Technology & Computer Science (T)",
            "Film & Photography (A/T)",
            "Fitness (Grade 10 only)",
            "Music (A)",
            "Visual Art (A)",
          ],
        },
      ],
    },
    {
      id: "ib",
      name: "IB Diploma · Grades 11 and 12",
      duration: "Grades 11 and 12",
      source_url: "https://www.isyedu.org/learning/ib-diploma-program",
      source_label: "Official website — IB Diploma Programme",
      summary:
        "ISY is an IB World School. All Grade 11 and 12 students take the Diploma Programme. A January 2024 IB visit reauthorised the programme for another five years. Students take one course from each of six groups plus TOK, the Extended Essay, and CAS.",
      years: [
        {
          name: "Studies in Language and Literature",
          subjects: ["English Language & Literature (SL / HL)", "Burmese Literature (SL / HL)"],
        },
        {
          name: "Language Acquisition",
          subjects: ["Chinese Language B (SL / HL)", "French Language B (SL / HL)", "Spanish ab initio (SL)"],
        },
        {
          name: "Individuals and Societies",
          subjects: ["Economics (SL / HL)", "Psychology (SL / HL)", "History (SL / HL)", "Business Management (SL / HL)"],
        },
        {
          name: "Sciences",
          subjects: [
            "Chemistry (SL / HL)",
            "Physics (SL / HL)",
            "Biology (SL / HL)",
            "Computer Science (SL / HL)",
            "Environmental Systems and Societies (SL / HL)",
          ],
        },
        {
          name: "Mathematics",
          subjects: ["Analysis & Approaches (SL / HL)", "Applications & Interpretation (SL / HL)"],
        },
        {
          name: "The Arts",
          subjects: ["Visual Art (SL / HL)"],
        },
        {
          name: "IB core",
          subjects: ["Theory of Knowledge", "Extended Essay", "Creativity, Activity, and Service"],
        },
      ],
      notes: [
        "FAQ also says Grades 11–12 may take Spanish ab initio or a mother-tongue course.",
        "High School Profile is linked for IB results and university acceptances; amounts and percentages on that PDF were not extracted in this pass.",
      ],
    },
  ],
};

const cca = {
  source_url: "https://www.isyedu.org/life-at-isy/after-school-activities",
  source_label: "Official website — After School Activities and Athletics",
  confidence: "likely",
  summary:
    "After School Activities cover arts, athletics, and service learning in two ten-week rounds each year. FAQ instead says activities run twice a year by semester. ISY competes in SEASAC and the Yangon Athletic Conference. The home page claims 250+ activities and 17+ student-led service groups; those counts are not listed on the ASA page.",
  groups: [
    {
      id: "asa",
      name: "After School Activities",
      items: [
        "Creative arts",
        "Athletics and sports skills",
        "Drama club",
        "Service learning initiatives",
        "Two ten-week rounds (Athletics Office sign-up)",
      ],
    },
    {
      id: "yac",
      name: "Yangon Athletic Conference (middle and high school)",
      items: ["Volleyball", "Soccer", "Basketball", "Badminton", "Swimming", "Table tennis"],
    },
    {
      id: "seasac",
      name: "SEASAC",
      items: [
        "Interscholastic sports with schools in Hong Kong, Thailand, Singapore, Malaysia, Myanmar, and Indonesia",
        "Fine arts conventions",
        "Model United Nations conventions",
      ],
    },
    {
      id: "expeditions",
      name: "Chinthe Expeditions",
      items: [
        "Grades 5 to 12",
        "Grade 5: two-night in-country trip",
        "Grades 6 to 12: overseas expeditions",
        "Service learning, physical activity, and academic exploration",
      ],
    },
  ],
};

const facilities = {
  source_url: "https://www.isyedu.org/learning/physical-education",
  source_label: "Official website — Physical Education, Visit ISY, and Food Services",
  confidence: "likely",
  summary:
    "PE lists current sports facilities. Visit ISY names the historic and SAS buildings. About says the board approved a new theatre, library, and cafeteria; the new-building page has drawings but no dates or costs in the extracted text.",
  groups: [
    {
      id: "sport",
      name: "Sports and movement",
      items: [
        "Gymnasium with two courts",
        "Climbing wall",
        "Swimming pool",
        "Fitness centre",
        "Outdoor playing field / re-surfaced football pitch",
        "Outdoor tennis court",
        "Covered basketball court",
      ],
    },
    {
      id: "buildings",
      name: "Campus buildings named on official pages",
      items: [
        "Colonial administration building",
        "Science, Arts and Sports (SAS) building",
        "Chinthe Cubs classrooms",
        "A Building (Elementary School)",
        "B Building (Chinthe Zay store on the first floor)",
        "Clinic on the first floor of SAS, where it meets A Building",
      ],
    },
    {
      id: "food",
      name: "Food services",
      items: [
        "Meatless campus",
        "Gusto — vegetarian options, now next to the gym",
        "Nourish — vegan, upper court next to B Building",
        "Cashless ID cards and bracelets, or cash",
      ],
    },
    {
      id: "planned",
      name: "Board-approved building project (About)",
      items: ["700-seat theatre", "Expanded library", "New cafeteria"],
    },
  ],
};

const campus = {
  school_name: "The International School Yangon (ISY)",
  address: "20 Shwe Taungyar Street, Bahan Township, Yangon",
  items: [
    {
      text: "Founded in 1955 as a non-profit Pre-K to Grade 12 school in Bahan Township. About calls it the oldest international school in Myanmar. Accredited by WASC, IB-authorised, and an EARCOS member.",
      source: "Official website — About ISY",
    },
    {
      text: "About says almost 500 students from more than 27 countries, with a nationality cap so no more than 30% of each grade is one nationality. The 2025–26 largest groups named are Myanmar, United States, South Korea, India, and Thailand. Home tiles say 500+ students and 27+ nationalities.",
      source: "Official website — About ISY and Home",
    },
    {
      text: "Apply for 2026–27 sets class-size guidelines: Chinthe Cubs 3 (16), Chinthe Cubs 4 (18), Kindergarten and Grade 1 (20), Grades 2–12 (22). The Director may grant exceptions.",
      source: "Official website — Apply to ISY",
    },
    {
      text: "Campus walk named on Visit ISY: colonial administration building, SAS building, Chinthe Cubs classrooms, swimming facilities, and a re-surfaced football pitch.",
      source: "Official website — Visit ISY",
    },
    {
      text: "Security page: trained on-campus security 24/7, plus fire, earthquake, and lockdown drills. Clinic: one doctor and a nurse during school hours, first floor of SAS.",
      source: "Official website — Security and Clinic",
    },
    {
      text: "School year is August to June. English is the medium of instruction. At least one parent or primary caregiver must be fluent in English.",
      source: "Official website — Apply to ISY",
    },
  ],
};

const summary = {
  school_id: ID,
  summary_text:
    "ISY is a 1955 non-profit school in Bahan, Yangon. Official pages describe a U.S. programme through Grade 10 and the IB Diploma in Grades 11–12. About says almost 500 students from 27+ nationalities. The live tuition page still does not publish 2026–27 amounts.",
  key_stats: [
    {
      label: "Curriculum",
      value: "U.S. through Grade 10, IB Diploma in Grades 11–12",
    },
    {
      label: "Students",
      value: "Almost 500 / 500+ on official pages",
    },
    {
      label: "Class size 2026–27",
      value: "16 (CC3) to 22 (Grades 2–12)",
    },
    {
      label: "Academic year",
      value: "August to June",
    },
    {
      label: "IB pass rate",
      value: "99% (official About tile)",
    },
    {
      label: "University acceptance",
      value: "100% (official About tile)",
    },
    {
      label: "Location",
      value: "20 Shwe Taungyar Street, Bahan, Yangon",
    },
  ],
  things_to_verify: [
    {
      category: "class size",
      confidence_label: "conflicting",
      reconciliation_note:
        "ISY Apply for 2026–27 publishes class-size guidelines of 16 / 18 / 20 / 22. International Schools Database lists average class size 20 and maximum 22, and a student count of 400. Official About says almost 500 students; home tiles say 500+.",
    },
    {
      category: "location",
      confidence_label: "conflicting",
      reconciliation_note:
        "Apply says the nationality cap ranges from 20% to 30% depending on grade. About and FAQ say no more than 30% of each grade can be of one nationality.",
    },
    {
      category: "curriculum",
      confidence_label: "conflicting",
      reconciliation_note:
        "Contact, Middle School, and High School name Ronnie Caldwell as Secondary School Principal. The Curriculum & Assessment page still tells parents to email Mike Simpson as Secondary School Principal for MAP reports. About names Mike Simpson as School Director.",
    },
  ],
};

patch("web/public/demo-register/schools.json", (payload) => {
  const school = (payload.schools || []).find((row) => row.id === ID);
  if (school) {
    school.curriculum_type = "U.S. curriculum through Grade 10 · IB Diploma Grades 11–12";
    school.official_website_url = "https://www.isyedu.org";
    school.official_facebook_url = "https://www.facebook.com/ISY.officialpage";
    school.address = "20 Shwe Taungyar Street, Bahan Township, Yangon";
  }
});

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
  const current = payload[ID] || { school_name: "The International School Yangon (ISY)", posters: [] };
  current.school_name = "The International School Yangon (ISY)";
  current.posters = (current.posters || []).map((poster, index) => {
    if (index !== 0) return poster;
    return {
      ...poster,
      source_url: "https://www.state.gov/wp-content/uploads/2025/06/Rangoon-Fact-Sheet-Burma.pdf",
      source_label: "State Department 2025 fact sheet",
      kicker: "Published source · tuition page has no amounts",
      confidence: "outdated",
      lead: "The 4 October 2026 recrawl of isyedu.org still finds no 2026–27 tuition table. Official pages publish an application fee and a deposit. Annual tuition amounts below are from the school’s 2025 U.S. State Department fact sheet (current as of December 2024).",
      notes: [
        "Tuition and Fees: Enrollment Fees plus Tuition Fees, paid to a U.S. association and a Myanmar entity. Typical annual rise 3–5%. No schedule is published.",
        "Apply 2026–27: application fee USD 300 (cash, bank transfer, or card). Admitted families pay a USD 1,000 admissions deposit.",
        "FAQ: no tuition discounts; paying the full year before school starts costs less than paying by semester; refund only if the child never attends a day.",
        "Scholarship page: two Grade 8 Myanmar-national awards a year, a full tuition and fee waiver through Grade 12. That is not a published fee table.",
        "The 2023–2024 State Department sheet listed Pre-K USD 15,948; K–5 USD 24,994; 6–8 USD 27,696; 9–12 USD 28,358; and a one-time K–12 registration fee of USD 9,500. That registration amount is not on the 2025 sheet.",
      ],
      shared: [
        { item: "Application fee (2026–27 apply page)", amount: "USD 300" },
        { item: "Admissions deposit after offer (apply page)", amount: "USD 1,000" },
      ],
    };
  });
  payload[ID] = current;
});

const summaryPath = path.join(ROOT, "web/public/school-summaries", `${ID}.json`);
fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

const mediaPath = path.join(ROOT, "web/public/school-media", `${ID}.json`);
const media = {
  items: [
    {
      kind: "video",
      url: "https://www.youtube.com/watch?v=xbhZXzU9m0w",
      embed: "https://www.youtube.com/embed/xbhZXzU9m0w",
      thumb: "https://img.youtube.com/vi/xbhZXzU9m0w/hqdefault.jpg",
      source: "Official website — A Welcome Message from Mr. Mike Simpson",
    },
    {
      kind: "video",
      url: "https://www.youtube.com/watch?v=9QjCMpxxXn4",
      embed: "https://www.youtube.com/embed/9QjCMpxxXn4",
      thumb: "https://img.youtube.com/vi/9QjCMpxxXn4/hqdefault.jpg",
      source: "Official website — Welcome to the ISY Community",
    },
    {
      kind: "video",
      url: "https://www.youtube.com/watch?v=LvJg5Io1eGk",
      embed: "https://www.youtube.com/embed/LvJg5Io1eGk",
      thumb: "https://img.youtube.com/vi/LvJg5Io1eGk/hqdefault.jpg",
      source: "Official website — Admissions / Visit ISY",
    },
  ],
};
fs.writeFileSync(mediaPath, `${JSON.stringify(media, null, 2)}\n`);

console.log("updated ISY official overlays from 2026-10-04 recrawl");
