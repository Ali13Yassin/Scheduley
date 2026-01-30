// import { findSchedule } from './scheduleFinder.js';  // Adjust the path as needed
import { initFileHandler, parseCSV } from './filesHandler.js';
import { renderSchedule } from './uiFunctions.js';
import { showAlert } from './alert.js';
let worker = new Worker("../js/scheduleFinder.js");

// Initialize the file handler
initFileHandler(); //TODO: only load when needed

// Check if website is loaded on mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobile) {
    showAlert("Mobile Warning", "This website is optimized for desktop use. Some features may not work properly on mobile devices.");
    document.getElementById('Errblur').style.backgroundColor = '#fffff';
    document.getElementById('Errblur').style.backdropFilter = 'blur(0)';
}

window.selectedResults = null; //Temporary to check if courses are selected

// Load the navbar, schedule visuals, and footer
fetch('nav.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('navbar').innerHTML = data;
    });
fetch('scheduleVisuals.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('schedule-container').innerHTML = data;
        document.getElementById('right-panel').innerHTML = data;
    });
fetch('footer.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('footer').innerHTML = data;
    });


function getSelectedFilters() {
    // Get filter values first
    const chosenDays = document.querySelector('input[name="numOfDays"]:checked');
    const chosenGaps = document.querySelector('input[name="findSchedulesWithGaps"]:checked');
    const chosenLabOrTutorialAfterLecture = document.querySelector('input[name="checkLabOrTutorialAfterLecture"]:checked');
    const chosenRemoveSingleSessionDays = document.querySelector('input[name="removeSingleSessionDays"]:checked');
    const sessionsToRemove = window.selectedSessionsToRemove;

    // Pack the filter values into an object to pass to the schedule generator
    const filterData = {
        days: chosenDays ? chosenDays.value : "any", // default to any if no value is selected
        numOfDays: chosenDays ? chosenDays.value : "any", // default to any if no value is selected
        gaps: chosenGaps ? chosenGaps.value : false, // default to false if no value is selected
        labOrTutorialAfterLecture: chosenLabOrTutorialAfterLecture ? chosenLabOrTutorialAfterLecture.value : false, // default to false if no value is selected
        chosenRemoveSingleSessionDays: chosenRemoveSingleSessionDays ? chosenRemoveSingleSessionDays.value : false, // default to false if no value is selected
        sessionsToRemove: sessionsToRemove ? sessionsToRemove : "none" // correctly refer to sessionsToRemove
    };
    return filterData;
}

let viewIndex = 0;
let filteredIndexes = null; // array of indexes into allSchedules matching active filter
let activeDayOff = null; // e.g., 'MON' or null

function computeDayUsage(schedule) {
    // Returns a Set of days present in schedule
    const days = new Set();
    if (Array.isArray(schedule)) {
        schedule.forEach(s => { if (s && s.day) days.add(s.day); });
    }
    return days;
}

function groupSchedulesByDayOff(schedules) {
    const map = { SUN: [], MON: [], TUE: [], WED: [], THU: [] };
    schedules.forEach((sched, idx) => {
        const used = computeDayUsage(sched);
        Object.keys(map).forEach(day => {
            if (!used.has(day)) map[day].push(idx);
        });
    });
    return map;
}

function updateResultsSummary() {
    const totalEl = document.getElementById('total-schedules');
    const idxEl = document.getElementById('current-index-label');
    const filterEl = document.getElementById('active-filter-label');
    const buttons = {
        SUN: document.getElementById('dayoff-SUN'),
        MON: document.getElementById('dayoff-MON'),
        TUE: document.getElementById('dayoff-TUE'),
        WED: document.getElementById('dayoff-WED'),
        THU: document.getElementById('dayoff-THU'),
    };

    const total = (window.allSchedules || []).length;
    if (totalEl) totalEl.textContent = `Found ${total} schedules`;

    const currentTotal = filteredIndexes ? filteredIndexes.length : total;
    const displayIdx = currentTotal > 0 ? ((filteredIndexes ? filteredIndexes.indexOf(viewIndex) : viewIndex) + 1) : 0;
    if (idxEl) idxEl.textContent = currentTotal > 0 ? `Viewing ${displayIdx} / ${currentTotal}` : '–';

    if (filterEl) {
        filterEl.textContent = activeDayOff ? `Filter: ${activeDayOff} off` : '';
    }

    // update counts on buttons
    const groups = groupSchedulesByDayOff(window.allSchedules || []);
    Object.entries(buttons).forEach(([day, btn]) => {
        if (!btn) return;
        const count = groups[day]?.length || 0;
        const label = day.charAt(0) + day.slice(1).toLowerCase();
        btn.textContent = `${label} off (${count})`;
        btn.disabled = count === 0;
        btn.classList.toggle('active', activeDayOff === day);
    });
}

function applyDayOffFilter(day) {
    activeDayOff = day;
    const groups = groupSchedulesByDayOff(window.allSchedules || []);
    filteredIndexes = day ? groups[day] : null;
    // reset viewIndex to first matching schedule
    if (filteredIndexes && filteredIndexes.length > 0) {
        viewIndex = filteredIndexes[0];
    } else {
        viewIndex = 0;
    }
    // Render based on current filter
    const schedules = window.allSchedules || [];
    if (schedules.length === 0) return;
    const idx = (filteredIndexes && filteredIndexes.length > 0) ? filteredIndexes[0] : 0;
    renderSchedule(schedules[idx], "schedule-details-container", window.assignedColors || {});
    updateResultsSummary();
}



//Course selection cards code
export function loadCourseCardView(courses, divId) {
    const courseGrid = document.getElementById(divId);
    // Initialize with previously selected courses (preserve across renders)
    let selectedCourses = new Set(divId === 'courseGrid' ? (window.selectedResults || []) : []);
    // Get courses from localStorage
    const detailsString = localStorage.getItem('courseDetails');

    // Store original courses data for filtering (only for the main course grid)
    if (divId === 'courseGrid') {
        window.originalCoursesData = courses;
    }
    window.originalCourseMetadata = detailsString ? JSON.parse(detailsString) : {};

    function renderCourses(coursesToRender) {
        courseGrid.innerHTML = ''; // Clear existing content before loading

        Object.entries(coursesToRender).forEach(([courseId, course]) => {
            const card = document.createElement('div');
            card.className = 'course-card';
            card.dataset.id = courseId; // Use the courseId (key) here
            const courseInfo = window.originalCourseMetadata[courseId] || {
                courseName: courseId,
                level: "Unknown",
                creditHours: "Unknown"
            };

            // Card content
            card.innerHTML = ` 
            <div class="course-card-title">${courseInfo["courseName"]}</div>
            <div class="course-card-code">${courseId}</div>
            <div class="course-card-details">CH:${courseInfo["creditHours"]}</div>
            `;

            // Restore selection state if this course was previously selected
            if (selectedCourses.has(courseId)) {
                card.classList.add('selected');
            }

            if (divId === "courseGrid") {
                card.addEventListener('click', () => {
                    // Toggle selection
                    if (selectedCourses.has(courseId)) {
                        selectedCourses.delete(courseId); // Remove from selected set
                        card.classList.remove('selected'); // Remove highlight
                    } else {
                        selectedCourses.add(courseId); // Add to selected set
                        card.classList.add('selected'); // Highlight card
                    }
                    window.selectedResults = Array.from(selectedCourses); // persist globally
                });
            } else {
                card.addEventListener('click', () => {
                    showSelectedCoursesDetails(courseId);
                    document.getElementById("mycourse-selection-container").style.display = "none";
                    document.getElementById("course-details-container").style.display = "block";
                });
            }

            courseGrid.appendChild(card);
        });
    }

    // Initial render
    renderCourses(courses);

    // Add search functionality only for courseGrid
    if (divId === "courseGrid") {
        const searchInput = document.getElementById('course-search-input');
        if (searchInput) {
            // Avoid stacking listeners on re-render
            searchInput.oninput = (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                const source = window.originalCoursesData || {};
                if (searchTerm === '') {
                    renderCourses(source);
                } else {
                    const filteredCourses = {};
                    Object.entries(source).forEach(([courseId, course]) => {
                        const courseInfo = window.originalCourseMetadata[courseId] || {
                            courseName: courseId,
                            level: "Unknown",
                            creditHours: "Unknown"
                        };
                        const matchesCourseCode = courseId.toLowerCase().includes(searchTerm);
                        const matchesCourseName = (courseInfo.courseName || '').toLowerCase().includes(searchTerm);
                        if (matchesCourseCode || matchesCourseName) {
                            filteredCourses[courseId] = course;
                        }
                    });
                    renderCourses(filteredCourses);
                }
            };
        }
    }
}

async function fetchCSV(url) {
    const response = await fetch(url);
    const text = await response.text();
    // Clear old cached data to ensure fresh parse
    localStorage.removeItem('coursesData');
    localStorage.removeItem('courseDetails');
    localStorage.removeItem('coursesDataDate');
    parseCSV(text);
    document.getElementById("online-import-container").style.display = "none";
    document.getElementById("course-selection-container").style.display = "block";
}

function showLoadingOverlay(text) {
    processOverlay.style.opacity = "1";
    processOverlay.style.visibility = "visible";
    document.getElementById('process-title').textContent = text;
}
function hideLoadingOverlay() {
    processOverlay.style.opacity = "0";
    processOverlay.style.visibility = "hidden";
}
// Initialize global storage for course details
window.courseDetailsStorage = {};

// Initialize selected sessions from localStorage when the script loads
(function initSelectedSessions() {
    const storedSessions = localStorage.getItem('selectedSessions');
    window.selectedSessionsToRemove = storedSessions ? JSON.parse(storedSessions) : {};
})();

function showSelectedCoursesDetails(courseId) {
    const coursesData = JSON.parse(localStorage.getItem('coursesData'));
    const courseDetails = coursesData[courseId];
    const container = document.getElementById('left-panel');
    container.innerHTML = '';

    // Initialize course entry if not exists
    if (!window.selectedSessionsToRemove[courseId]) {
        window.selectedSessionsToRemove[courseId] = {
            lectures: [],
            labs: [],
            tutorials: []
        };
    }

    function createSessionCard(sessionGroup, type, index) {
        const card = document.createElement('div');
        card.className = 'course-card';
        const sessionType = type.toLowerCase();

        // Use the first session to get the class name (e.g. "Lecture 13")
        // and lecturer (assuming they are consistent for the group)
        const firstSession = sessionGroup[0];
        const className = firstSession.class;
        const lecturer = firstSession.lecturer;

        // generated HTML for all sessions in this group
        let detailsHTML = "";
        sessionGroup.forEach(session => {
            detailsHTML += `
                <div class="session-detail-row" style="margin-bottom: 4px;">
                    <strong>${session.day}</strong>: ${session.start} - ${session.end}<br>
                    <span style="font-size: 0.9em; color: #666;">${session.location}</span>
                </div>
             `;
        });

        card.innerHTML = `
            <div class="session-card-title">${className}</div>
             <div class="session-card-details">
                ${detailsHTML}
                <div style="margin-top: 4px; border-top: 1px solid #eee; padding-top: 4px;">
                    ${lecturer}
                </div>
            </div>
        `;

        // Check existing selections
        // logic: if ANY session in this group is found in selectedSessionsToRemove, 
        // it counts as selected (implied: the whole group is selected/removed).
        // Actually, selectedSessionsToRemove stores "class" names usually.
        // Let's check how it stores them: "sessionsArray.push(session.class);"
        // So checking if the class name relies in the list is enough.

        const isSelected = window.selectedSessionsToRemove[courseId][sessionType]
            .includes(className);

        if (isSelected) card.classList.add('selected');

        card.addEventListener('click', () => {
            const sessionsArray = window.selectedSessionsToRemove[courseId][sessionType];
            const sessionIndex = sessionsArray.indexOf(className);

            if (card.classList.contains('selected')) {
                // Remove selection
                card.classList.remove('selected');
                if (sessionIndex > -1) sessionsArray.splice(sessionIndex, 1);
            } else {
                // Add selection
                card.classList.add('selected');
                if (sessionIndex === -1) sessionsArray.push(className);
            }

            // persistSelectedSessions();
            updateTimetablePreview();
        });

        // Preview on hover - render ALL sessions in the group
        card.addEventListener('mouseenter', () => {
            renderSchedule(sessionGroup, 'course-details-container', window.assignedColors || {});
        });

        card.addEventListener('mouseleave', () => {

        });

        return card;
    }
    // Add lectures
    if (courseDetails.lectures && courseDetails.lectures.length > 0) {
        const lectureHeader = document.createElement('div');
        lectureHeader.className = 'session-type-header';
        lectureHeader.textContent = 'Lectures';
        container.appendChild(lectureHeader);

        courseDetails.lectures.forEach((lecture, index) => {
            container.appendChild(createSessionCard(lecture, 'lectures', index));
        });
    }

    // Add labs
    if (courseDetails.labs && courseDetails.labs.length > 0) {
        const labHeader = document.createElement('div');
        labHeader.className = 'session-type-header';
        labHeader.textContent = 'Labs';
        container.appendChild(labHeader);

        courseDetails.labs.forEach((lab, index) => {
            container.appendChild(createSessionCard(lab, 'labs', index));
        });
    }

    // Add tutorials
    if (courseDetails.tutorials && courseDetails.tutorials.length > 0) {
        const tutorialHeader = document.createElement('div');
        tutorialHeader.className = 'session-type-header';
        tutorialHeader.textContent = 'Tutorials';
        container.appendChild(tutorialHeader);

        courseDetails.tutorials.forEach((tutorial, index) => {
            container.appendChild(createSessionCard(tutorial, 'tutorials', index));
        });
    }
}

// Example timetable preview update function
function updateTimetablePreview() {
    // Implementation to update a timetable display based on selectedSessions
    console.log('Current selections:', window.selectedSessionsToRemove);
}

// Centralized stage navigation
const STAGES = [
    'online-import-container',
    'upload-container',
    'course-selection-container',
    'mycourse-selection-container',
    'course-details-container',
    'filter-selection-menu',
    'schedule-details-container'
];

function showStage(idToShow) {
    STAGES.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = (id === idToShow) ? 'block' : 'none';
    });
}

// Schedule navigation buttons

// Online Import schedule buttons
document.getElementById("SUT-online-import").addEventListener("click", function () {
    showLoadingOverlay("Downloading information");
    const url = "https://script.google.com/macros/s/AKfycbzU19SF_yf_b0iZLqzBUapkq4K7bmee9AN7yeW-h34O3Cw7epwbzM50li_kOTgCyJNH/exec";
    fetchCSV(url)
        .then(() => hideLoadingOverlay());
});

// Back schedule button
document.getElementById("back").addEventListener("click", function () {
    const schedules = window.allSchedules || [];
    if (schedules.length === 0) return;
    if (filteredIndexes && filteredIndexes.length > 0) {
        const pos = filteredIndexes.indexOf(viewIndex);
        const prevPos = (pos <= 0 ? filteredIndexes.length - 1 : pos - 1);
        viewIndex = filteredIndexes[prevPos];
    } else {
        viewIndex--;
        if (viewIndex < 0) { viewIndex = schedules.length - 1; }
    }
    renderSchedule(schedules[viewIndex], "schedule-details-container", window.assignedColors || {});
    updateResultsSummary();
});

// Next schedule button
document.getElementById("next").addEventListener("click", function () {
    const schedules = window.allSchedules || [];
    if (schedules.length === 0) return;
    if (filteredIndexes && filteredIndexes.length > 0) {
        const pos = filteredIndexes.indexOf(viewIndex);
        const nextPos = (pos >= filteredIndexes.length - 1 ? 0 : pos + 1);
        viewIndex = filteredIndexes[nextPos];
    } else {
        viewIndex++;
        if (viewIndex >= schedules.length) { viewIndex = 0; }
    }
    renderSchedule(schedules[viewIndex], "schedule-details-container", window.assignedColors || {});
    updateResultsSummary();
});

// Save schedule button
document.getElementById("save-schedule-button").addEventListener("click", function () {
    localStorage.setItem('savedSchedule', JSON.stringify(allSchedules[viewIndex]));
    localStorage.setItem('savedColors', JSON.stringify(window.assignedColors || {}));
    showAlert("Schedule saved", "This DOES NOT register you in this course, you need to manually register in SIS!", "mySchedule.html", "View schedule");
});

// Import schedule buttons
document.getElementById("upload-button").addEventListener("click", function () {
    showStage('upload-container');
});

// Filter menu buttons
document.getElementById("show-filter-menu-button").addEventListener("click", function () {
    // TODO: check if a course has no sessions chosen
    document.getElementById("mycourse-selection-container").style.display = "none";
    document.getElementById("filter-selection-menu").style.display = "block";
});
document.getElementById("save-mycourse-details").addEventListener("click", function () {
    document.getElementById("course-details-container").style.display = "none";
    document.getElementById("mycourse-selection-container").style.display = "block";
});
document.getElementById("backto-online-import-button").addEventListener("click", function () {
    showStage('online-import-container');
});

document.getElementById("course-selection-back").addEventListener("click", function () {
    showStage('upload-container');
});

document.getElementById("show-mycourse-details-button").addEventListener("click", function () {
    if (!selectedResults) {
        showAlert("No courses selected", "Please select courses first");
        return;
    }
    const coursesData = JSON.parse(localStorage.getItem('coursesData'));
    const selectedCourses = {};
    selectedResults.forEach(courseId => {
        if (coursesData[courseId]) {
            selectedCourses[courseId] = coursesData[courseId];
        }
    });
    loadCourseCardView(selectedCourses, "mycourseGrid");
    document.getElementById("course-selection-container").style.display = "none";
    document.getElementById("mycourse-selection-container").style.display = "block";
});

document.getElementById("mycourse-back").addEventListener("click", function () {
    showStage('course-selection-container');
    // Restore the full dataset to the main grid and reset search
    const allCourses = JSON.parse(localStorage.getItem('coursesData')) || window.originalCoursesData || {};
    const searchInput = document.getElementById('course-search-input');
    if (searchInput) searchInput.value = '';
    loadCourseCardView(allCourses, 'courseGrid');
});

document.getElementById("show-filter-menu-button").addEventListener("click", function () {
    // ...existing checks...
    showStage('filter-selection-menu');
});

document.getElementById("course-details-back").addEventListener("click", function () {
    showStage('mycourse-selection-container');
});

document.getElementById("save-mycourse-details").addEventListener("click", function () {
    // ...existing save...
    showStage('mycourse-selection-container');
});

document.getElementById("filter-back").addEventListener("click", function () {
    showStage('mycourse-selection-container');
});

// After generation, allow going back to filters
const scheduleBackToFiltersBtn = document.getElementById('schedule-stage-back');
if (scheduleBackToFiltersBtn) {
    scheduleBackToFiltersBtn.addEventListener('click', function () {
        showStage('filter-selection-menu');
    });
}

// When schedules are ready, switch to schedule stage
// In worker.onmessage -> processResults():
// showStage('schedule-details-container');
// document.getElementById("center-container").style.display = "none"; // not needed if using showStage

// Immutable base palette, per-run assigned colors stored separately
window.BASE_COURSE_COLORS = [
    ["#F17141", "#FFECAE"],
    ["#FFECAE", "#F17141"],
    ["#702FE5", "#F9CDD1"],
    ["#25092E", "#F2C0DD"],
    ["#F2C0DD", "#25092E"],
    ["#1F3FC3", "#EFEFD7"],
    ["#EFEFD7", "#1F3FC3"],
    ["#475E3D", "#B9D5E6"],
    ["#1C304F", "#B9D5E6"],
    ["#B9D5E6", "#1C304F"],
];
window.assignedColors = window.assignedColors || {};

// Make schedule button
document.getElementById("processButton").addEventListener("click", function () {
    const filterData = getSelectedFilters();
    const startTime = Date.now();

    if (!window.selectedResults || window.selectedResults.length === 0) {
        showAlert("No courses selected", "Please select at least one course");
        return;
    }

    // Randomly assign colors to selected courses without mutating the base palette
    const assignedColors = {};
    const availableColors = [...window.BASE_COURSE_COLORS];
    selectedResults.forEach(courseId => {
        const randomIndex = Math.floor(Math.random() * availableColors.length);
        assignedColors[courseId] = availableColors.splice(randomIndex, 1)[0];
        if (availableColors.length === 0) {
            availableColors.push(...window.BASE_COURSE_COLORS);
        }
    });
    window.assignedColors = assignedColors;

    worker.postMessage({ selectedResults, filterData, coursesData: JSON.parse(localStorage.getItem('coursesData')) });
    showLoadingOverlay("Finding Your Schedule");

    worker.onmessage = function (e) {
        let data = e.data;
        if (data.type === "error") {
            console.error("Worker error:", data.message);
            showAlert("An error happened", "Please try again");
            hideLoadingOverlay();
            return;
        }
        const timeElapsed = Date.now() - startTime;
        const minimumLoadTime = 5000; // 5 seconds
        const processResults = () => {
            if (data.schedules.length === 0) {
                showAlert("No schedules found", "Try adjusting your filters");
                hideLoadingOverlay();
                return;
            }
            window.allSchedules = data.schedules;
            console.log("Total schedules found: " + allSchedules.length);
            // document.getElementById("center-container").style.display = "none";
            // document.getElementById("schedule-details-container").style.display = "block";
            renderSchedule(allSchedules[0], "schedule-details-container", assignedColors);
            viewIndex = 0;
            filteredIndexes = null;
            activeDayOff = null;
            updateResultsSummary();
            showStage('schedule-details-container');
            hideLoadingOverlay();
        };
        if (timeElapsed < minimumLoadTime) {
            setTimeout(processResults, minimumLoadTime - timeElapsed);
        } else {
            processResults();
        }
    };

    worker.onerror = function (event) {
        console.error("Worker error:", event.message);
        showAlert("An error happened", "Please try again");
        hideLoadingOverlay();
    };
});

// Wire day-off filter buttons
function wireDayOffButtons() {
    const ids = ['SUN', 'MON', 'TUE', 'WED', 'THU'];
    ids.forEach(day => {
        const btn = document.getElementById(`dayoff-${day}`);
        if (btn) btn.addEventListener('click', () => applyDayOffFilter(day));
    });
    const clearBtn = document.getElementById('clear-dayoff-filter');
    if (clearBtn) clearBtn.addEventListener('click', () => applyDayOffFilter(null));
}

// Ensure buttons are wired once DOM is ready (module executes after HTML load)
wireDayOffButtons();