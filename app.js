
"use strict";

/* =========================================
   1. CONFIGURATION
========================================= */

const START = "2026-08-10";
const END = "2026-11-30";

/* DO NOT CHANGE: preserves existing attendance data */
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

const LIVE_PERIODS = [
  {start:480,end:530},
  {start:535,end:585},
  {start:590,end:640},
  {start:645,end:695},
  {start:765,end:815},
  {start:825,end:875},
  {start:885,end:935}
];

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
const clone = value => JSON.parse(JSON.stringify(value));


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
  if(!box) return;

  box.textContent=text;
  box.className=error?"error":"";
  box.style.display="block";

  clearTimeout(box._timer);

  box._timer=setTimeout(()=>{
    box.style.display="none";
  },3500);
}

function weekdayName(date) {
  return new Date(date+"T12:00:00").toLocaleDateString(
    "en-US",{weekday:"long"}
  );
}

function isWeekend(date) {
  const day=new Date(date+"T12:00:00").getDay();
  return day===0||day===6;
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
      hours:Number(s.hours)>0?Number(s.hours):1
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
   3. SAVE AND LOAD
========================================= */

function loadData() {
  try {
    const saved=localStorage.getItem(KEY);
    data=normalizeData(saved?JSON.parse(saved):clone(SEED));
  } catch(error) {
    data=normalizeData(clone(SEED));
    notify("Could not read saved data. Check your backup.",true);
  }

  saveData(false);
}

function saveData(show=true) {
  try {
    localStorage.setItem(KEY,JSON.stringify(data));
    if(show) notify("Attendance saved in this browser.");
  } catch(error) {
    notify("Could not save data. Browser storage may be full.",true);
  }
}

function validDate(date) {
  return !!date&&date>=START&&date<=END;
}


/* =========================================
   4. TIMETABLE GENERATION
========================================= */

function makeSessions(date,type,rep) {
  if(type==="holiday") return [];

  const day=type==="saturday"
    ? (rep||"Monday")
    : weekdayName(date);

  return (TIMETABLE[day]||[]).map((subject,index)=>({
    period:index+1,
    subject:subject||(index===1?"Free period":"Mentoring"),
    status:"N",
    optional:!subject,
    hours:1
  }));
}


/* =========================================
   5. NAVIGATION
========================================= */

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(screen=>{
    screen.classList.toggle("active",screen.id===name);
  });

  document.querySelectorAll(".nav-item").forEach(button=>{
    button.classList.toggle("active",button.dataset.screen===name);
  });

  window.scrollTo({top:0,behavior:"smooth"});

  if(name==="dashboard") renderDashboard();

  if(name==="attendance") {
    selectedSubject=null;
    showAttendanceOverview();
    renderAttendance();
  }

  if(name==="reports") renderMonth();
  if(name==="more") renderTargets();
}

document.querySelectorAll(".nav-item").forEach(button=>{
  button.addEventListener("click",()=>{
    showScreen(button.dataset.screen);
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
      date,type,$("weekday").value
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

  currentSessions.forEach((session,index)=>{
    const card=document.createElement("div");
    card.className="subject";

    const title=document.createElement("div");
    title.className="subject-head";

    const name=document.createElement("span");
    name.textContent=
      `Period ${session.period} · ${session.subject}`;

    const edit=document.createElement("button");
    edit.type="button";
    edit.className="edit-subject";
    edit.textContent="✎ Change";
    edit.onclick=()=>openSubjectEditor(index);

    title.append(name,edit);
    card.appendChild(title);

    const time=document.createElement("p");
    time.className="muted";
    time.textContent=
      `${PERIOD_TIMES[session.period-1]||"Time not set"} · ${session.hours||1} hour(s)`;

    card.appendChild(time);

    const choices=document.createElement("div");
    choices.className="choices";

    [["P","Present"],["A","Absent"],["N","Not Held"]]
      .forEach(([value,label])=>{
        const button=document.createElement("button");
        button.type="button";
        button.textContent=label;

        button.className=session.status===value
          ? (value==="P"?"selected-p":
             value==="A"?"selected-a":"selected-n")
          : "";

        button.onclick=()=>{
          currentSessions[index].status=value;
          drawSessions();
        };

        choices.appendChild(button);
      });

    card.appendChild(choices);
    root.appendChild(card);
  });
}


/* =========================================
   7. SUBJECT EDITOR
========================================= */

function openSubjectEditor(index) {
  editingIndex=index;

  const session=currentSessions[index];
  if(!session) return;

  $("modalPeriod").textContent=
    `Period ${session.period} · Current subject: ${session.subject}`;

  $("replacementSubject").value=
    SUBJECTS.some(s=>s.name===session.subject)
      ? session.subject
      : "Maths";

  $("replacementHours").value=session.hours||1;

  $("subjectModal").classList.add("open");
}

function closeSubjectEditor() {
  $("subjectModal").classList.remove("open");
  editingIndex=null;
}

$("cancelSubject").onclick=closeSubjectEditor;

$("subjectModal").addEventListener("click",event=>{
  if(event.target===$("subjectModal")) {
    closeSubjectEditor();
  }
});

$("confirmSubject").onclick=()=>{
  if(editingIndex===null) return;

  const subject=$("replacementSubject").value;
  const hours=Number($("replacementHours").value);

  if(!SUBJECTS.some(s=>s.name===subject)) {
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
   8. SAVE AND CLEAR DATE
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
      weekday:type==="saturday"?$("weekday").value:null,
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

  if(!confirm("Clear all attendance entries for "+date+"?")) return;

  if(isWeekend(date)) {
    data.days[date]={type:"holiday",sessions:[]};
  } else {
    data.days[date]={type:"working",weekday:null,sessions:[]};
  }

  saveData(false);
  loadEntry();
  refreshAll();

  notify("Date cleared.");
}

function getTodayDate() {
  const now=new Date();
  return [
    now.getFullYear(),
    String(now.getMonth()+1).padStart(2,"0"),
    String(now.getDate()).padStart(2,"0")
  ].join("-");
}

function getInitialDate() {
  const today=getTodayDate();
  if(today<START) return START;
  if(today>END) return END;
  return today;
}

$("date").value=getInitialDate();

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
    $("date").value,"saturday",$("weekday").value
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

  SUBJECTS.forEach(subject=>{
    subjects[subject.name]={
      ...subject,
      held:0,
      present:0,
      absent:0,
      notheld:0
    };
  });

  for(const day of days) {
    if(!day||day.type==="holiday") continue;

    for(const session of day.sessions||[]) {
      const item=subjects[session.subject];

      if(!item||session.optional) continue;

      if(session.status==="P") {
        item.held++;
        item.present++;
      } else if(session.status==="A") {
        item.held++;
        item.absent++;
      } else if(session.status==="N") {
        item.notheld++;
      }
    }
  }

  const total=Object.values(subjects).reduce((result,subject)=>({
    held:result.held+subject.held,
    present:result.present+subject.present,
    absent:result.absent+subject.absent,
    notheld:result.notheld+subject.notheld,
    target:result.target+subject.total
  }),{
    held:0,present:0,absent:0,notheld:0,target:0
  });

  return {subjects,total};
}

function percent(a,b) {
  return b?Math.min(100,(100*a)/b):0;
}

function showPercent(a,b) {
  return b?percent(a,b).toFixed(2)+"%":"—";
}


/* =========================================
   10. PERCENTAGE MODES
========================================= */

function selectedPercent(subject) {
  return percentageMode==="held"
    ? showPercent(subject.present,subject.held)
    : showPercent(subject.present,subject.total);
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

    return $("sort").value==="asc"?pa-pb:pb-pa;
  });

  $("subjectReports").innerHTML=list.map(subject=>{
    const p=percentageMode==="held"
      ? percent(subject.present,subject.held)
      : percent(subject.present,subject.total);

    return `
      <div class="subject clickable"
        role="button"
        tabindex="0"
        data-subject="${escapeHTML(subject.name)}">

        <div class="subject-head">
          <span>${escapeHTML(subject.name)}</span>
          <strong>${selectedPercent(subject)}</strong>
        </div>

        <div class="muted">
          ${subject.present} present · ${subject.absent} absent ·
          ${subject.held} held · target ${subject.total}
        </div>

        <div class="progress">
          <span style="width:${Math.min(100,p)}%"></span>
        </div>
      </div>
    `;
  }).join("");

  $("subjectReports").querySelectorAll("[data-subject]")
    .forEach(element=>{
      const open=()=>openSubject(element.dataset.subject);

      element.addEventListener("click",open);

      element.addEventListener("keydown",event=>{
        if(event.key==="Enter"||event.key===" ") {
          event.preventDefault();
          open();
        }
      });
    });

  if(selectedSubject&&$("subjectDetail").style.display!=="none") {
    openSubject(selectedSubject);
  }
}


/* =========================================
   11. SUBJECT DETAILS
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
        .filter(session=>
          session.subject===name&&!session.optional
        )
        .forEach(session=>all.push({date,session}));
    });

  const counts={P:0,A:0,N:0};
  all.forEach(item=>counts[item.session.status]++);

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
    ? all.map(({date,session})=>`
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
            Period ${session.period} ·
            ${escapeHTML(PERIOD_TIMES[session.period-1]||"Time not set")}
            · ${session.hours||1} hour(s)
          </div>
        </div>

        <span class="status ${session.status}">${session.status}</span>
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

  $("dashPercent").textContent=showPercent(total.present,total.held);
  $("dashPresent").textContent=total.present;
  $("dashHeld").textContent=total.held;
  $("dashSubjects").textContent=SUBJECTS.length;

  $("dashboardSubjects").innerHTML=SUBJECTS.map(subject=>{
    const item=subjects[subject.name];
    const p=percent(item.present,subject.total);

    return `
      <div class="subject clickable"
        data-subject="${escapeHTML(subject.name)}">

        <div class="subject-head">
          <span>${escapeHTML(subject.name)}</span>
          <span class="badge">${item.held} / ${subject.total} held</span>
        </div>

        <div class="muted">
          ${item.present} present · ${item.absent} absent ·
          ${p.toFixed(2)}% of target
        </div>

        <div class="progress">
          <span style="width:${Math.min(100,p)}%"></span>
        </div>
      </div>
    `;
  }).join("");

  $("dashboardSubjects").querySelectorAll("[data-subject]")
    .forEach(element=>{
      element.onclick=()=>{
        showScreen("attendance");
        openSubject(element.dataset.subject);
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
  const year=reportMonth.getFullYear();
  const month=reportMonth.getMonth();

  $("monthName").textContent=
    reportMonth.toLocaleDateString(
      "en-US",{month:"long",year:"numeric"}
    );

  const entries=Object.entries(data.days)
    .filter(([date])=>{
      const d=new Date(date+"T12:00:00");
      return d.getFullYear()===year&&d.getMonth()===month;
    })
    .sort(([a],[b])=>a.localeCompare(b));

  const {total}=calculate(entries.map(entry=>entry[1]));

  $("monthHeld").textContent=total.held;
  $("monthPresent").textContent=total.present;
  $("monthAbsent").textContent=total.absent;
  $("monthPercent").textContent=showPercent(total.present,total.held);

  $("monthRecords").innerHTML=entries.map(([date,day])=>{
    const counts=calculate([day]).total;

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
            {weekday:"short",day:"numeric",month:"short"}
          )}</strong>
          <span class="badge">${label}</span>
        </div>

        <small>
          ${
            day.type==="holiday"
              ? escapeHTML(day.reason||"Holiday")
              : `${counts.present} present · ${counts.absent} absent · ${counts.notheld} not held`
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

  $("targetRows").innerHTML=SUBJECTS.map(subject=>{
    const item=subjects[subject.name];

    return `
      <tr>
        <td>${escapeHTML(subject.name)}</td>
        <td>${subject.total}</td>
        <td>${item.held}</td>
        <td>${item.present}</td>
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
  const anchor=document.createElement("a");

  anchor.href=url;
  anchor.download="self-attendance-backup.json";
  anchor.click();

  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify("SELF ATTENDANCE backup exported.");
};


/* =========================================
   16. IMPORT BACKUP
========================================= */

$("import").onclick=async()=>{
  const file=$("importFile").files[0];

  if(!file) {
    return notify("Choose a JSON file first.",true);
  }

  if(!confirm("Importing will replace the attendance data in this browser. Continue?")) {
    return;
  }

  try {
    const imported=JSON.parse(await file.text());

    if(!imported.days) {
      throw new Error("This JSON does not contain attendance days.");
    }

    data=normalizeData(imported);
    saveData(false);
    refreshAll();
    loadEntry();

    notify("Backup imported successfully.");

  } catch(error) {
    notify("Import failed: "+error.message,true);
  }
};


/* =========================================
   17. LIVE CLASS TRACKER
========================================= */

function formatClock(minutes) {
  const hour=Math.floor(minutes/60);
  const minute=minutes%60;

  const suffix=hour>=12?"PM":"AM";
  const displayHour=hour%12||12;

  return `${displayHour}:${String(minute).padStart(2,"0")} ${suffix}`;
}

function getLiveSessions(date) {
  const day=data.days[date];

  if(day?.type==="holiday") return [];

  if(day&&Array.isArray(day.sessions)) {
    return day.sessions;
  }

  const weekday=weekdayName(date);

  if(TIMETABLE[weekday]) {
    return makeSessions(date,"working");
  }

  if(day?.type==="saturday") {
    return day.sessions||[];
  }

  return [];
}

function renderLiveTracker() {
  const card=$("liveClassCard");
  if(!card||!data) return;

  const now=new Date();

  const date=[
    now.getFullYear(),
    String(now.getMonth()+1).padStart(2,"0"),
    String(now.getDate()).padStart(2,"0")
  ].join("-");

  const current=now.getHours()*60+now.getMinutes();

  const sessions=getLiveSessions(date);

  /* Skip free periods and mentoring periods */
  const periods=sessions.map(session=>{
    const index=Number(session.period)-1;
    const timing=LIVE_PERIODS[index];

    if(!timing||session.optional) return null;

    if(!SUBJECTS.some(subject=>subject.name===session.subject)) {
      return null;
    }

    return {
      ...session,
      start:timing.start,
      end:timing.end
    };
  }).filter(Boolean).sort((a,b)=>a.start-b.start);

  const ongoing=periods.find(p=>
    current>=p.start&&current<p.end
  );

  const upcoming=periods.find(p=>
    p.start>current
  );

  const status=$("liveClassStatus");
  const subject=$("liveSubject");
  const period=$("livePeriod");
  const time=$("liveTime");
  const countdown=$("liveCountdown");
  const progressWrap=$("liveProgressWrap");
  const progress=$("liveProgress");

  let selected=null;

  if(ongoing) {
    selected=ongoing;

    status.textContent="ONGOING CLASS";

    const elapsed=current-ongoing.start;
    const duration=ongoing.end-ongoing.start;
    const remaining=ongoing.end-current;

    progressWrap.style.display="block";
    progress.style.width=
      Math.min(100,Math.max(0,(elapsed/duration)*100))+"%";

    countdown.textContent=
      remaining===1?"1 minute remaining":
      remaining+" minutes remaining";

    card.classList.add("is-ongoing");

  } else if(upcoming) {
    selected=upcoming;

    status.textContent="NEXT CLASS";

    const difference=upcoming.start-current;

    progressWrap.style.display="none";
    progress.style.width="0%";

    countdown.textContent=difference<60
      ? "Starts in "+difference+" minutes"
      : "Starts in "+Math.floor(difference/60)+"h "+(difference%60)+"m";

    card.classList.remove("is-ongoing");

  } else {
    status.textContent="NO CLASS";
    subject.textContent="No scheduled classes";

    period.textContent=
      data.days[date]?.type==="holiday"
        ? "Today is a holiday"
        : "No more scheduled classes today";

    time.textContent="";
    countdown.textContent="Enjoy your free time!";

    progressWrap.style.display="none";
    progress.style.width="0%";

    card.classList.remove("is-ongoing");
    return;
  }

  subject.textContent=selected.subject;
  period.textContent="Period "+selected.period;

  time.textContent=
    formatClock(selected.start)+" – "+formatClock(selected.end);
}


/* =========================================
   18. REFRESH ALL SCREENS
========================================= */

function refreshAll() {
  renderDashboard();
  renderAttendance();
  renderMonth();
  renderTargets();
  renderLiveTracker();
}


/* =========================================
   19. START APPLICATION
========================================= */

loadData();

const firstDate=getInitialDate();
$("date").value=firstDate;

const stored=data.days[firstDate];

$("daytype").value=stored?.type||
  (isWeekend(firstDate)?"holiday":"working");

loadEntry();
refreshAll();

renderLiveTracker();

setInterval(renderLiveTracker,1000);

document.addEventListener("visibilitychange",()=>{
  if(!document.hidden) {
    renderLiveTracker();
  }
});
