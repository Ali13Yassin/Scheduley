import { showAlert } from './alert.js';

// Base palette (same as scheduleFinderMain)
// Steel Red, Fantasy Orange, Leila, Aesthetic Teal, Light Ocean Green
const BASE_COURSE_COLORS = [
  ["#D74C4C", "#FFFFFF"],  // Steel Red
  ["#F49729", "#FFFFFF"],  // Fantasy Orange
  ["#27284E", "#FFFFFF"],  // Leila (dark blue)
  ["#1A9399", "#FFFFFF"],  // Aesthetic Teal
  ["#7CCBA9", "#27284E"],  // Light Ocean Green (dark text)
];

// Load navbar/footer
fetch('nav.html').then(r => r.text()).then(html => (document.getElementById('navbar').innerHTML = html));
fetch('footer.html').then(r => r.text()).then(html => (document.getElementById('footer').innerHTML = html));

const scheduleText = document.getElementById('schedule-json');
const loadBtn = document.getElementById('load-btn');
const randomizeBtn = document.getElementById('randomize-btn');
const saveBtn = document.getElementById('save-btn');
const colorsSection = document.getElementById('colors-section');
const list = document.getElementById('course-color-list');

let schedule = [];
let assignedColors = {};

function randomizeColorsForCourses(courseKeys) {
  const pool = [...BASE_COURSE_COLORS];
  const mapping = {};
  courseKeys.forEach(key => {
    if (pool.length === 0) pool.push(...BASE_COURSE_COLORS);
    const idx = Math.floor(Math.random() * pool.length);
    mapping[key] = pool.splice(idx, 1)[0];
  });
  return mapping;
}

function renderColorEditor(courseKeys) {
  list.innerHTML = '';
  courseKeys.forEach(key => {
    const row = document.createElement('div');
    row.className = 'row';

    const pill = document.createElement('div');
    pill.className = 'course-pill';
    pill.textContent = key;

    const bg = document.createElement('input');
    bg.type = 'color';
    bg.value = assignedColors[key]?.[0] || '#D74C4C';

    const fg = document.createElement('input');
    fg.type = 'color';
    fg.value = assignedColors[key]?.[1] || '#FFFFFF';

    const preview = document.createElement('div');
    preview.textContent = 'Preview';
    preview.style.border = '1px solid #e5e7eb';
    preview.style.borderRadius = '8px';
    preview.style.padding = '6px 10px';
    preview.style.minWidth = '120px';
    const applyPreview = () => {
      preview.style.background = bg.value;
      preview.style.color = fg.value;
    };
    applyPreview();

    bg.addEventListener('input', () => { assignedColors[key][0] = bg.value; applyPreview(); });
    fg.addEventListener('input', () => { assignedColors[key][1] = fg.value; applyPreview(); });

    row.appendChild(pill);
    row.appendChild(bg);
    row.appendChild(fg);
    row.appendChild(preview);
    list.appendChild(row);
  });
}

loadBtn.addEventListener('click', () => {
  let parsed;
  try {
    parsed = JSON.parse(scheduleText.value.trim());
  } catch (e) {
    showAlert('Invalid JSON', 'Please paste a valid savedSchedule JSON array.');
    return;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    showAlert('Empty schedule', 'The JSON must be a non-empty array of sessions.');
    return;
  }
  schedule = parsed;
  const courseKeys = Array.from(new Set(parsed.map(s => s.course).filter(Boolean)));
  assignedColors = randomizeColorsForCourses(courseKeys);
  colorsSection.style.display = 'block';
  renderColorEditor(courseKeys);
  randomizeBtn.disabled = false;
  saveBtn.disabled = false;
});

randomizeBtn.addEventListener('click', () => {
  const courseKeys = Array.from(new Set(schedule.map(s => s.course).filter(Boolean)));
  assignedColors = randomizeColorsForCourses(courseKeys);
  renderColorEditor(courseKeys);
});

saveBtn.addEventListener('click', () => {
  try {
    localStorage.setItem('savedSchedule', JSON.stringify(schedule));
    localStorage.setItem('savedColors', JSON.stringify(assignedColors));
    showAlert('Schedule imported', 'Opening My Schedule with your colors.', 'mySchedule.html', 'Open My Schedule');
  } catch (e) {
    showAlert('Error', 'Could not save to localStorage.');
  }
});
