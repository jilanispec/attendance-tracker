"use strict";

/* =========================================
   1. CONFIGURATION
========================================= */

const START = "2026-08-10";
const END = "2026-11-30";
const KEY = "jilan_attendance_json_v1";

const SUBJECTS = [
  {name:"Maths",total:75},
  {name:"Chemistry",total:45},
  {name:"Chemistry Lab",total:30},
  {name:"PSC",total:45},
  {name:"PSC Lab",total:30},
  {name:"Biology",total:15},
  {name:"English",total:45},
  {name:"DT",total:50},
  {name:"ES",total:50},
  {name:"IE",total:45}
];

const TIMETABLE = {
  Monday:["DT","PSC","Chemistry","English",null,null,"Chemistry"],
  Tuesday:["Maths","DT","PSC","ES","ES","English","DT"],
  Wednesday:["IE",null,"PSC Lab","PSC Lab","PSC","Maths","Maths"],
  Thursday:["Chemistry","IE","English","English","Maths","Biology","ES"],
  Friday:["Maths","IE","Chemistry Lab","Chemistry Lab","PSC","Chemistry","IE"]
};

const PERIOD_TIMES = [
  "8:00–8:50 AM",
  "8:55–9:45 AM",
  "9:50–10:40 AM",
  "10:45–11:35 AM",
  "12:45–1:35 PM",
  "1:45–2:35 PM",
  "2:45–3:35 PM"
];

/* Existing browser data takes priority over this starter data. */
const SEED = {
  semester:{start:START,end:END},
  subjects:SUBJECTS,
  days:{},
  gpa:{sgpa:7.9,cgpa:8.5}
};

let data;
let currentSessions = [];
let percentageMode = "held";
let reportMonth = new Date(2026,7,1);
let selectedSubject = null;
let editingIndex = null;

const $ = id => document.getElementById(id);
const clone = x => JSON.parse(JSON.stringify(x));


/* =========================================
   2. COMMON HELPERS
========================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function notify(text,error=false) {
  const box=$("message");
  box.textContent=text;
  box.className=error?"error":"";
  box.style.display="block";
  setTimeout(()=>box.style.display="none",3500);
}

function weekdayName(date) {
  return new Date(date+"T12:00:00").toLocaleDateString(
    "en-US",{weekday:"long"}
  );
}

function isWeekend(date) {
  const d=new Date(date+"T12:00:00").getDay();
  return d===0||d===6;
}

function blankData() {
  return {
    semester:{start:START,end:END},
    subjects:clone(SUBJECTS),
    days:{},
    gpa:{sgpa:null,cgpa:null}
  };
}

function normalizeData(input) {
  const d=input&&typeof input==="object"
    ? input
    : blankData();

  if(!d.days||typeof d.days!=="object") {
    d.days={};
  }

  d.semester={start:START,end:END};
  d.subjects=clone(SUBJECTS);

  if(!d.gpa||typeof d.gpa!=="object") {
    d.gpa={sgpa:null,cgpa:null};
  }

  for(const date of Object.keys(d.days)) {
    const day=d.days[date]||{};

    day.sessions=Array.isArray(day.sessions)
      ? day.sessions
      : [];

    day.sessions=day.sessions.map(s=>({
      ...s,
      period:Number(s.period)||1,
      status:["P","A","N"].includes(s.status)
        ? s.status
        : "N",
      optional:!!s.optional,
      hours:Number(s.hours)>0
        ? Number(s.hours)
        : 1
    }));

    if(!["working","saturday","holiday"].includes(day.type)) {
      day.type=isWeekend(date)
        ? (day.sessions.length?"saturday":"holiday")
        : "working";
    }

    if(day.type==="saturday"&&!day.weekday) {
      day.weekday="Monday";
    }

    d.days[date]=day;
  }

  return d;
}


/* =========================================
   3. SAVE AND LOAD DATA
========================================= */

function loadData() {
  try {
    const saved=localStorage.getItem(KEY);

    data=normalizeData(
      saved ? JSON.parse(saved) : clone(SEED)
    );

  } catch(e) {
    data=normalizeData(clone(SEED));
    notify("Could not read saved data. Check your backup.",true);
  }

  saveData(false);
}

function saveData(show=true) {
  localStorage.setItem(KEY,JSON.stringify(data));

  if(show) {
    notify("Attendance saved in this browser.");
  }
}

function validDate(date) {
  return date&&date>=START&&date<=END;
}


/* =========================================
   4. TIMETABLE SESSION GENERATION
========================================= */

function makeSessions(date,type,rep) {
  if(type==="holiday") return [];

  const day=type==="saturday"
    ? (rep||"Monday")
    : weekdayName(date);

  return (TIMETABLE[day]||[]).map((subject,i)=>({
    period:i+1,
    subject:subject||(i===1?"Free period":"Mentoring"),
    status:"N",
    optional:!subject,
    hours:1
  }));
}


/* =========================================
   5. NAVIGATION
========================================= */

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s=>{
    s.classList.toggle("active",s.id===name);
  });

  document.querySelectorAll(".nav-item").forEach(b=>{
    b.classList.toggle("active",b.dataset.screen===name);
  });

  window.scrollTo({top:0,behavior:"smooth"});

  if(name==="dashboard") {
    renderDashboard();
  }

  if(name==="attendance") {
    selectedSubject=null;
    showAttendanceOverview();
    renderAttendance();
  }

  if(name==="reports") {
    renderMonth();
  }

  if(name==="more") {
    renderTargets();
  }
}

document.querySelectorAll(".nav-item").forEach(b=>{
  b.addEventListener("click",()=>{
    showScreen(b.dataset.screen);
  });
});


/* =========================================
   6. DAILY ATTENDANCE ENTRY
========================================= */

function loadEntry() {
  const date=$("date").value;

  if(!validDate(date)) {
    notify("Choose a date inside the semester.",true);
    return;
  }

  const old=data.days[date];
  const type=$("daytype").value;

  $("weekdayWrap").style.display=
    type==="saturday"?"block":"none";

  $("holidayWrap").style.display=
    type==="holiday"?"block":"none";

  if(type==="saturday") {
    $("weekday").value=old?.weekday||"Monday";
  }

  if(old&&old.type===type) {
    currentSessions=clone(old.sessions||[]);
    $("holidayReason").value=old.reason||"";
  } else {
    currentSessions=makeSessions(
      date,
      type,
      $("weekday").value
    );

    $("holidayReason").value="";
  }

  drawSessions();
}

function drawSessions() {
  const root=$("sessions");
  root.innerHTML="";

  if($("daytype").value==="holiday") {
    root.innerHTML=
      '<p class="muted">Holiday selected. No classes will be counted for this date.</p>';
    return;
  }

  currentSessions.forEach((s,index)=>{
    const card=document.createElement("div");
    card.className="subject";

    const title=document.createElement("div");
    title.className="subject-head";

    const name=document.createElement("span");
    name.textContent=`Period ${s.period} · ${s.subject}`;

    const edit=document.createElement("button");
    edit.type="button";
    edit.className="edit-subject";
    edit.textContent="✎ Change";
    edit.onclick=()=>openSubjectEditor(index);

    title.appendChild(name);
    title.appendChild(edit);
    card.appendChild(title);

    const time=document.createElement("p");
    time.className="muted";
    time.textContent=
      `${PERIOD_TIMES[s.period-1]||"Time not set"} · ${s.hours||1} hour(s)`;

    card.appendChild(time);

    const choices=document.createElement("div");
    choices.className="choices";

    [["P","Present"],["A","Absent"],["N","Not Held"]]
      .forEach(([value,label])=>{
        const b=document.createElement("button");
        b.textContent=label;

        b.className=s.status===value
          ? (value==="P"?"selected-p":
             value==="A"?"selected-a":"selected-n")
          : "";

        b.onclick=()=>{
          currentSessions[index].status=value;
          drawSessions();
        };

        choices.appendChild(b);
      });

    card.appendChild(choices);
    root.appendChild(card);
  });
}


/* =========================================
   7. SUBJECT CHANGE POPUP
========================================= */

function openSubjectEditor(index) {
  editingIndex=index;

  const s=currentSessions[index];
  if(!s) return;

  $("modalPeriod").textContent=
    `Period ${s.period} · Current subject: ${s.subject}`;

  $("replacementSubject").value=
    SUBJECTS.some(x=>x.name===s.subject)
      ? s.subject
      : "Maths";

  $("replacementHours").value=s.hours||1;

  $("subjectModal").classList.add("open");
}

function closeSubjectEditor() {
  $("subjectModal").classList.remove("open");
  editingIndex=null;
}

$("cancelSubject").onclick=closeSubjectEditor;

$("subjectModal").addEventListener("click",e=>{
  if(e.target===$("subjectModal")) {
    closeSubjectEditor();
  }
});

$("confirmSubject").onclick=()=>{
  if(editingIndex===null) return;

  const subject=$("replacementSubject").value;
  const hours=Number($("replacementHours").value);

  if(!SUBJECTS.some(x=>x.name===subject)) {
    notify("Choose a valid subject.",true);
    return;
  }

  if(!Number.isFinite(hours)||hours<0.25||hours>12) {
    notify("Hours must be between 0.25 and 12.",true);
    return;
  }

  currentSessions[editingIndex].subject=subject;
  currentSessions[editingIndex].hours=hours;
  currentSessions[editingIndex].optional=false;

  closeSubjectEditor();
  drawSessions();

  notify("Period updated. Press Save attendance to store the change.");
};


/* =========================================
   8. SAVE AND CLEAR A DATE
========================================= */

function saveDay() {
  const date=$("date").value;

  if(!validDate(date)) {
    notify("Invalid semester date.",true);
    return;
  }

  const type=$("daytype").value;

  if(type==="holiday") {
    data.days[date]={
      type:"holiday",
      reason:$("holidayReason").value.trim()||"Holiday",
      sessions:[]
    };
  } else {
    data.days[date]={
      type,
      weekday:type==="saturday"
        ? $("weekday").value
        : null,
      sessions:clone(currentSessions)
    };
  }

  saveData(false);
  refreshAll();

  notify("Attendance saved for "+date+".");
}

function clearDay() {
  const date=$("date").value;
  if(!validDate(date)) return;

  if(isWeekend(date)) {
    data.days[date]={
      type:"holiday",
      sessions:[]
    };
  } else {
    data.days[date]={
      type:"working",
      weekday:null,
      sessions:[]
    };
  }

  saveData(false);
  loadEntry();
  refreshAll();

  notify("Date cleared. No attendance sessions were generated.");
}

$("date").value="2026-11-05";

$("date").onchange=()=>{
  const date=$("date").value;
  const old=data.days[date];

  $("daytype").value=old?.type||
    (isWeekend(date)?"holiday":"working");

  loadEntry();
};

$("daytype").onchange=loadEntry;

$("weekday").onchange=()=>{
  currentSessions=makeSessions(
    $("date").value,
    "saturday",
    $("weekday").value
  );

  drawSessions();
};

$("saveDay").onclick=saveDay;
$("clearDay").onclick=clearDay;


/* =========================================
   9. ATTENDANCE CALCULATIONS
========================================= */

function calculate(days) {
  const subjects={};

  SUBJECTS.forEach(s=>{
    subjects[s.name]={
      ...s,
      held:0,
      present:0,
      absent:0,
      notheld:0
    };
  });

  for(const day of days) {
    if(!day||day.type==="holiday") continue;

    for(const s of day.sessions||[]) {
      const item=subjects[s.subject];

      if(!item||s.optional) continue;

      if(s.status==="P") {
        item.held++;
        item.present++;
      } else if(s.status==="A") {
        item.held++;
        item.absent++;
      } else if(s.status==="N") {
        item.notheld++;
      }
    }
  }

  const total=Object.values(subjects).reduce((a,s)=>({
    held:a.held+s.held,
    present:a.present+s.present,
    absent:a.absent+s.absent,
    notheld:a.notheld+s.notheld,
    target:a.target+s.total
  }),{
    held:0,
    present:0,
    absent:0,
    notheld:0,
    target:0
  });

  return {subjects,total};
}

function percent(a,b) {
  return b ? Math.min(100,(100*a)/b) : 0;
}

function showPercent(a,b) {
  return b ? percent(a,b).toFixed(2)+"%" : "—";
}


/* =========================================
   10. TWO PERCENTAGE MODES
========================================= */

/*
  HELD %:
  Present / (Present + Absent) × 100

  SEMESTER TARGET %:
  Present / Semester target × 100

  Not Held is excluded from Held %.
  Both modes are capped at 100%.
*/

function selectedPercent(s) {
  return percentageMode==="held"
    ? showPercent(s.present,s.held)
    : showPercent(s.present,s.total);
}

function showAttendanceOverview() {
  $("attendanceOverview").style.display="block";
  $("subjectDetail").style.display="none";
}

function renderAttendance() {
  const {subjects,total}=calculate(Object.values(data.days));

  $("overallPercent").textContent=
    percentageMode==="held"
      ? showPercent(total.present,total.held)
      : showPercent(total.present,total.target);

  $("totalHeld").textContent=total.held;
  $("totalPresent").textContent=total.present;
  $("totalAbsent").textContent=total.absent;
  $("totalNotHeld").textContent=total.notheld;

  $("formula").textContent=
    percentageMode==="held"
      ? "Held % = Present ÷ (Present + Absent) × 100. Maximum = 100%."
      : "Semester Target % = Present ÷ Total Classes (Settings) × 100. Maximum = 100%.";

  const list=Object.values(subjects).sort((a,b)=>{
    const pa=percentageMode==="held"
      ? percent(a.present,a.held)
      : percent(a.present,a.total);

    const pb=percentageMode==="held"
      ? percent(b.present,b.held)
      : percent(b.present,b.total);

    return $("sort").value==="asc"
      ? pa-pb
      : pb-pa;
  });

  $("subjectReports").innerHTML=list.map(s=>{
    const p=percentageMode==="held"
      ? percent(s.present,s.held)
      : percent(s.present,s.total);

    return `
      <div class="subject clickable"
        role="button"
        tabindex="0"
        data-subject="${escapeHTML(s.name)}">

        <div class="subject-head">
          <span>${escapeHTML(s.name)}</span>
          <strong>${selectedPercent(s)}</strong>
        </div>

        <div class="muted">
          ${s.present} present · ${s.absent} absent ·
          ${s.held} held · target ${s.total}
        </div>

        <div class="progress">
          <span style="width:${Math.min(100,p)}%"></span>
        </div>
      </div>
    `;
  }).join("");

  $("subjectReports").querySelectorAll("[data-subject]")
    .forEach(el=>{
      const open=()=>openSubject(el.dataset.subject);

      el.addEventListener("click",open);

      el.addEventListener("keydown",e=>{
        if(e.key==="Enter"||e.key===" ") {
          e.preventDefault();
          open();
        }
      });
    });

  if(selectedSubject&&$("subjectDetail").style.display!=="none") {
    openSubject(selectedSubject);
  }
}


/* =========================================
   11. SUBJECT DATE-BY-DATE DETAIL
========================================= */

function openSubject(name) {
  selectedSubject=name;

  $("attendanceOverview").style.display="none";
  $("subjectDetail").style.display="block";

  const all=[];

  Object.entries(data.days)
    .sort(([a],[b])=>a.localeCompare(b))
    .forEach(([date,day])=>{
      if(day.type==="holiday") return;

      (day.sessions||[])
        .filter(s=>s.subject===name&&!s.optional)
        .forEach(s=>all.push({date,day,s}));
    });

  const counts={P:0,A:0,N:0};
  all.forEach(x=>counts[x.s.status]++);

  const held=counts.P+counts.A;
  const target=SUBJECTS.find(s=>s.name===name).total;

  $("detailName").textContent=name;

  $("detailSummary").textContent=
    `${all.length} saved period entries · Semester target ${target}`;

  $("detailP").textContent=counts.P;
  $("detailA").textContent=counts.A;
  $("detailN").textContent=counts.N;

  $("detailPct").textContent=
    percentageMode==="held"
      ? showPercent(counts.P,held)
      : showPercent(counts.P,target);

  $("subjectDateRecords").innerHTML=all.length
    ? all.map(({date,s})=>`
      <div class="record-line">
        <div>
          <strong>${new Date(date+"T12:00:00").toLocaleDateString(
            "en-GB",
            {
              weekday:"long",
              day:"2-digit",
              month:"short",
              year:"numeric"
            }
          )}</strong>

          <div class="record-meta">
            Period ${s.period} ·
            ${escapeHTML(PERIOD_TIMES[s.period-1]||"Time not set")}
            · ${s.hours||1} hour(s)
          </div>
        </div>

        <span class="status ${s.status}">${s.status}</span>
      </div>
    `).join("")
    : '<div class="empty">No saved attendance entries for this subject yet.</div>';

  window.scrollTo({top:0,behavior:"smooth"});
}

$("backSubjects").onclick=()=>{
  showAttendanceOverview();
  renderAttendance();
};

$("heldButton").onclick=()=>{
  percentageMode="held";

  $("heldButton").className="chosen";
  $("overallButton").className="secondary";

  renderAttendance();
};

$("overallButton").onclick=()=>{
  percentageMode="overall";

  $("overallButton").className="chosen";
  $("heldButton").className="secondary";

  renderAttendance();
};

$("sort").onchange=renderAttendance;


/* =========================================
   12. DASHBOARD
========================================= */

function renderDashboard() {
  const {subjects,total}=calculate(Object.values(data.days));

  $("todayLabel").textContent=new Date().toLocaleDateString(
    undefined,
    {
      weekday:"long",
      day:"numeric",
      month:"long",
      year:"numeric"
    }
  );

  $("dashPercent").textContent=
    showPercent(total.present,total.held);

  $("dashPresent").textContent=total.present;
  $("dashHeld").textContent=total.held;

  $("dashboardSubjects").innerHTML=SUBJECTS.map(s=>{
    const x=subjects[s.name];
    const p=percent(x.present,x.total);

    return `
      <div class="subject clickable"
        data-subject="${escapeHTML(s.name)}">

        <div class="subject-head">
          <span>${escapeHTML(s.name)}</span>
          <span class="badge">${x.held} / ${s.total} held</span>
        </div>

        <div class="muted">
          ${x.present} present · ${x.absent} absent ·
          ${p.toFixed(2)}% of target
        </div>

        <div class="progress">
          <span style="width:${Math.min(100,p)}%"></span>
        </div>
      </div>
    `;
  }).join("");

  $("dashboardSubjects").querySelectorAll("[data-subject]")
    .forEach(el=>{
      el.onclick=()=>{
        showScreen("attendance");
        openSubject(el.dataset.subject);
      };
    });

  $("sgpa").value=data.gpa?.sgpa??"";
  $("cgpa").value=data.gpa?.cgpa??"";
}

$("saveGpa").onclick=()=>{
  const a=$("sgpa").value;
  const b=$("cgpa").value;

  if(
    (a!==""&&(Number(a)<0||Number(a)>10))||
    (b!==""&&(Number(b)<0||Number(b)>10))
  ) {
    return notify("SGPA and CGPA must be between 0 and 10.",true);
  }

  data.gpa={
    sgpa:a===""?null:Number(a),
    cgpa:b===""?null:Number(b)
  };

  saveData();
};


/* =========================================
   13. MONTHLY REPORTS
========================================= */

function renderMonth() {
  const y=reportMonth.getFullYear();
  const m=reportMonth.getMonth();

  $("monthName").textContent=
    reportMonth.toLocaleDateString(
      "en-US",
      {month:"long",year:"numeric"}
    );

  const entries=Object.entries(data.days)
    .filter(([date])=>{
      const d=new Date(date+"T12:00:00");

      return d.getFullYear()===y&&d.getMonth()===m;
    })
    .sort(([a],[b])=>a.localeCompare(b));

  const {total}=calculate(entries.map(x=>x[1]));

  $("monthHeld").textContent=total.held;
  $("monthPresent").textContent=total.present;
  $("monthAbsent").textContent=total.absent;

  $("monthPercent").textContent=
    showPercent(total.present,total.held);

  $("monthRecords").innerHTML=entries.map(([date,day])=>{
    const c=calculate([day]).total;

    const label=day.type==="holiday"
      ? "Holiday"
      : day.type==="saturday"
        ? "Special Saturday"
        : "Working day";

    return `
      <div class="day-card">
        <div class="subject-head">
          <strong>${new Date(date+"T12:00:00").toLocaleDateString(
            "en-US",
            {
              weekday:"short",
              day:"numeric",
              month:"short"
            }
          )}</strong>

          <span class="badge">${label}</span>
        </div>

        <small>
          ${
            day.type==="holiday"
              ? escapeHTML(day.reason||"Holiday")
              : `${c.present} present · ${c.absent} absent · ${c.notheld} not held`
          }
        </small>
      </div>
    `;
  }).join("")||
    '<div class="empty">No saved records for this month.</div>';
}

$("previousMonth").onclick=()=>{
  reportMonth.setMonth(reportMonth.getMonth()-1);

  if(reportMonth<new Date(2026,7,1)) {
    reportMonth=new Date(2026,7,1);
  }

  renderMonth();
};

$("nextMonth").onclick=()=>{
  reportMonth.setMonth(reportMonth.getMonth()+1);

  if(reportMonth>new Date(2026,10,1)) {
    reportMonth=new Date(2026,10,1);
  }

  renderMonth();
};


/* =========================================
   14. SUBJECT TARGETS
========================================= */

function renderTargets() {
  const {subjects}=calculate(Object.values(data.days));

  $("targetRows").innerHTML=SUBJECTS.map(s=>{
    const x=subjects[s.name];

    return `
      <tr>
        <td>${escapeHTML(s.name)}</td>
        <td>${s.total}</td>
        <td>${x.held}</td>
        <td>${x.present}</td>
      </tr>
    `;
  }).join("");

  $("storageInfo").textContent=
    Object.keys(data.days).length+
    " saved dates · Browser storage key: "+KEY;
}


/* =========================================
   15. EXPORT BACKUP
========================================= */

$("export").onclick=()=>{
  const blob=new Blob(
    [JSON.stringify(data,null,2)],
    {type:"application/json"}
  );

  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");

  a.href=url;
  a.download="jilan-attendance-backup.json";
  a.click();

  setTimeout(()=>URL.revokeObjectURL(url),1000);

  notify("JSON backup exported.");
};


/* =========================================
   16. IMPORT BACKUP
========================================= */

$("import").onclick=async()=>{
  const file=$("importFile").files[0];

  if(!file) {
    return notify("Choose a JSON file first.",true);
  }

  try {
    const imported=JSON.parse(await file.text());

    if(!imported.days) {
      throw new Error(
        "This JSON does not contain attendance days."
      );
    }

    data=normalizeData(imported);

    saveData(false);
    refreshAll();
    loadEntry();

    notify("Backup imported successfully.");

  } catch(e) {
    notify("Import failed: "+e.message,true);
  }
};


/* =========================================
   17. REFRESH ALL SCREENS
========================================= */

function refreshAll() {
  renderDashboard();
  renderAttendance();
  renderMonth();
  renderTargets();
}


/* =========================================
   18. START APPLICATION
========================================= */

loadData();

const firstDate=$("date").value;
const stored=data.days[firstDate];

$("daytype").value=stored?.type||
  (isWeekend(firstDate)?"holiday":"working");

loadEntry();
refreshAll();
