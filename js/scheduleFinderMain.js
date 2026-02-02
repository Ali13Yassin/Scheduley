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

// ===================================
// UI ENHANCEMENT FUNCTIONS
// ===================================

// Update selection counter badge
function updateSelectionCounter() {
    const count = window.selectedResults?.length || 0;
    const countEl = document.getElementById('selected-count');
    const counterEl = document.getElementById('selection-counter');
    if (countEl) countEl.textContent = count;
    if (counterEl) {
        counterEl.classList.add('animate__animated', 'animate__pulse');
        setTimeout(() => counterEl.classList.remove('animate__animated', 'animate__pulse'), 300);
    }
}

// Update search results count
function updateSearchResultsCount(shown, total) {
    const el = document.getElementById('search-results-count');
    if (!el) return;
    if (shown === total) {
        el.textContent = `${total} courses`;
    } else {
        el.textContent = `${shown} of ${total}`;
    }
}

// Update step progress wizard
const STEP_MAP = {
    'online-import-container': 1,
    'upload-container': 1,
    'course-selection-container': 2,
    'mycourse-selection-container': 3,
    'course-details-container': 3,
    'filter-selection-menu': 4,
    'schedule-details-container': 5
};

function updateStepProgress(stageId) {
    const currentStep = STEP_MAP[stageId] || 1;
    const stepItems = document.querySelectorAll('.step-item');
    const progressFill = document.getElementById('progress-fill');

    stepItems.forEach((item, index) => {
        const stepNum = index + 1;
        const circle = item.querySelector('.step-circle');
        item.classList.remove('active', 'completed');

        if (stepNum < currentStep) {
            item.classList.add('completed');
            // Show checkmark
            circle.innerHTML = `
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
            `;
        } else if (stepNum === currentStep) {
            item.classList.add('active');
            circle.innerText = stepNum;
        } else {
            circle.innerText = stepNum;
        }
    });

    // Update progress bar width (0% to 80% based on step 1-5)
    if (progressFill) {
        const percent = ((currentStep - 1) / 4) * 80;
        progressFill.style.width = `${percent}%`;
    }
}

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

// let viewIndex = 0; // REMOVED: Use window.viewIndex as single source of truth
window.viewIndex = window.viewIndex || 0; // Ensure initialized
let filteredIndexes = null; // array of indexes into allSchedules matching active filter
window.activeDaysOff = new Set(); // Multi-select Support

// ===================================
// LOCK SLOT FEATURE
// ===================================
window.lockedGroups = new Set(); // Stores "COURSE-TYPE-ClassName" keys

// Helper: Derive session type from class name
function getSessionType(className) {
    if (!className) return 'lectures';
    const lower = className.toLowerCase();
    if (lower.includes('lec')) return 'lectures';
    if (lower.includes('lab')) return 'labs';
    if (lower.includes('tut')) return 'tutorials';
    return 'lectures'; // Default
}

// Helper: Generate lock key from session (using ||| delimiter to avoid conflicts with hyphens in data)
function getLockKey(course, sessionType, className) {
    return `${course}|||${sessionType}|||${className}`;
}

// Toggle lock state for a session group
function toggleLock(course, className) {
    console.log('[toggleLock] ===== START =====');
    const sessionType = getSessionType(className);
    const key = getLockKey(course, sessionType, className);
    const wasLocked = window.lockedGroups.has(key);

    if (wasLocked) {
        window.lockedGroups.delete(key);
    } else {
        window.lockedGroups.add(key);
    }

    // Fix 4: For custom/swapped schedules, we MUST recompute filters so navigation knows about the new lock.
    const generatedCount = window.generatedScheduleCount || window.allSchedules.length;
    const isCustomSchedule = window.viewIndex >= generatedCount;

    // ALWAYS recompute filters so "Next" button works correctly with new lock
    recomputeFilteredIndexes();

    updateResultsSummary();
    // Re-render to update lock icons
    const schedules = window.allSchedules || [];
    if (schedules.length > 0 && schedules[window.viewIndex]) {
        renderSchedule(schedules[window.viewIndex], "schedule-details-container", window.assignedColors || {});
    }
    console.log('[toggleLock] ===== END =====');
}

// Check if a session is locked
function isLocked(course, className) {
    const sessionType = getSessionType(className);
    const key = getLockKey(course, sessionType, className);
    return window.lockedGroups.has(key);
}

// Clear all locks
function clearAllLocks() {
    window.lockedGroups.clear();
    recomputeFilteredIndexes();
    updateResultsSummary();
    const schedules = window.allSchedules || [];
    if (schedules.length > 0 && schedules[window.viewIndex]) {
        renderSchedule(schedules[window.viewIndex], "schedule-details-container", window.assignedColors || {});
    }
}

// Check if schedule contains ALL locked sessions
function scheduleMatchesLocks(schedule, lockedGroups) {
    if (lockedGroups.size === 0) return true;

    // For each locked key, check if schedule has a matching session
    for (const lockKey of lockedGroups) {
        const parts = lockKey.split('|||');
        if (parts.length !== 3) continue; // Invalid key, skip
        const [course, sessionType, className] = parts;
        const found = schedule.some(s =>
            s.course === course && s.class === className
        );
        if (!found) return false;
    }
    return true;
}

// Recompute filtered indexes: DaysOff Intersection ∩ Locks
function recomputeFilteredIndexes() {
    const schedules = window.allSchedules || [];
    if (schedules.length === 0) {
        filteredIndexes = null;
        return;
    }

    // Ensure viewIndex is a number
    if (typeof window.viewIndex !== 'number') {
        window.viewIndex = parseInt(window.viewIndex, 10) || 0;
    }

    // Start with all indexes
    let indexes = schedules.map((_, i) => i);

    // Apply DayOff filter (Multi-select AND Logic)
    if (window.activeDaysOff.size > 0) {
        const groups = groupSchedulesByDayOff(schedules);

        // Schedule must match ALL selected days
        for (const day of window.activeDaysOff) {
            const dayMatches = groups[day] || [];
            indexes = indexes.filter(i => dayMatches.includes(i));
        }
    }

    // Apply Lock filter
    if (window.lockedGroups.size > 0) {
        indexes = indexes.filter(i => {
            return scheduleMatchesLocks(schedules[i], window.lockedGroups);
        });
    }

    // Set result
    filteredIndexes = indexes.length > 0 ? indexes : null;

    // STICKY VIEW IMPLEMENTATION:
    const isCustomSchedule = window.viewIndex >= (window.generatedScheduleCount || window.allSchedules.length);

    if (isCustomSchedule && window.viewIndex >= 0 && schedules[window.viewIndex]) {
        if (!filteredIndexes) filteredIndexes = [];
        if (!filteredIndexes.includes(window.viewIndex)) {
            // Force custom index into filtered list
            filteredIndexes.push(window.viewIndex);
        }
    }

    // Adjust viewIndex if current not in filtered (Should not happen with Sticky View if custom)
    if (filteredIndexes && !filteredIndexes.includes(window.viewIndex)) {
        window.viewIndex = filteredIndexes[0];
    }
}

// Expose helpers globally for UI access
window.scheduleApp = {
    toggleLock,
    isLocked,
    clearAllLocks,
    getSessionType,
    getLockKey
};


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
    const displayIdx = currentTotal > 0 ? ((filteredIndexes ? filteredIndexes.indexOf(window.viewIndex) : window.viewIndex) + 1) : 0;
    if (idxEl) idxEl.textContent = currentTotal > 0 ? `Viewing ${displayIdx} / ${currentTotal}` : '–';

    if (filterEl) {
        const days = Array.from(window.activeDaysOff).sort();
        filterEl.textContent = days.length > 0 ? `Filter: ${days.join(', ')} off` : '';
    }

    // Update counts and visibility on buttons (Dynamic Facets)
    const schedules = window.allSchedules || [];
    const groups = groupSchedulesByDayOff(schedules);
    const dayNames = Object.keys(buttons);

    // Helper: Compute potential count if a day filter were added to current context
    const getPotentialCount = (dayToAdd) => {
        // Base: All schedules
        let candidates = schedules.map((_, i) => i);

        // Apply existing active filters (EXCLUDING the one we are testing if it's already active)
        // Wait, normally facets show results if we *keep* current selection.
        // If I have Mon selected, and I look at Mon, it shows current count.
        // If I look at Sun, it shows count if I add Sun (Mon AND Sun).

        // Multi-select AND logic:
        const hypotheticalSet = new Set(window.activeDaysOff);
        hypotheticalSet.add(dayToAdd); // Ensure it's in the set for test

        // 1. Filter by Days
        for (const d of hypotheticalSet) {
            const dayMatches = groups[d] || [];
            candidates = candidates.filter(i => dayMatches.includes(i));
        }

        // 2. Filter by Locks (Locks are always active)
        if (window.lockedGroups.size > 0) {
            candidates = candidates.filter(i => {
                return scheduleMatchesLocks(schedules[i], window.lockedGroups);
            });
        }

        return candidates.length;
    };

    dayNames.forEach(day => {
        const btn = buttons[day];
        if (!btn) return;

        const count = getPotentialCount(day);
        const isActive = window.activeDaysOff.has(day);

        // Refined Label: Just "Mon", "Tue" etc.
        const label = day.charAt(0) + day.slice(1).toLowerCase();

        // Badge Logic
        // Remove existing badge if any
        let badge = btn.querySelector('.badge-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge-count';
            btn.appendChild(badge);
        }
        badge.textContent = count;

        // Button Text (Clean)
        // Use first child text node to avoid overwriting badge
        // Store badge, clear content, re-append text + badge
        const badgeClone = badge.cloneNode(true);
        btn.textContent = `${label} off `;
        btn.appendChild(badgeClone);

        btn.disabled = count === 0 && !isActive; // Disable if 0 results (unless already active)
        btn.classList.toggle('active', isActive);

        // Visibility: Hide if count is 0 and NOT active
        if (count === 0 && !isActive) {
            btn.classList.add('hidden');
        } else {
            btn.classList.remove('hidden');
        }
    });
}

function applyDayOffFilter(day) {
    if (!day) {
        // Clear all
        window.activeDaysOff.clear();
    } else {
        // Toggle logic
        if (window.activeDaysOff.has(day)) {
            window.activeDaysOff.delete(day);
        } else {
            window.activeDaysOff.add(day);
        }
    }

    // Use centralized filter computation (includes lock intersection)
    recomputeFilteredIndexes();

    // Render based on current filter
    const schedules = window.allSchedules || [];
    if (schedules.length > 0 && schedules[window.viewIndex]) {
        renderSchedule(schedules[window.viewIndex], "schedule-details-container", window.assignedColors || {});
    }
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
                        // Add pop animation
                        card.classList.add('animate__animated', 'animate__pulse');
                        setTimeout(() => card.classList.remove('animate__animated', 'animate__pulse'), 300);
                    }
                    window.selectedResults = Array.from(selectedCourses); // persist globally
                    updateSelectionCounter();
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

    // Update initial counts for course selection grid
    if (divId === 'courseGrid') {
        const totalCount = Object.keys(courses).length;
        updateSearchResultsCount(totalCount, totalCount);
        updateSelectionCounter();
    }

    // Add search functionality only for courseGrid
    if (divId === "courseGrid") {
        const searchInput = document.getElementById('course-search-input');
        if (searchInput) {
            // Avoid stacking listeners on re-render
            searchInput.oninput = (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                const source = window.originalCoursesData || {};
                const totalCount = Object.keys(source).length;
                if (searchTerm === '') {
                    renderCourses(source);
                    updateSearchResultsCount(totalCount, totalCount);
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
                    updateSearchResultsCount(Object.keys(filteredCourses).length, totalCount);
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
    showStage('course-selection-container');
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
        lectureHeader.style.backgroundColor = '#DBEAFE';
        lectureHeader.style.color = '#1E40AF';
        lectureHeader.innerHTML = '<svg style="width:16px;height:16px;margin-right:6px" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/></svg> Lectures';
        container.appendChild(lectureHeader);

        courseDetails.lectures.forEach((lecture, index) => {
            container.appendChild(createSessionCard(lecture, 'lectures', index));
        });
    }

    // Add labs
    if (courseDetails.labs && courseDetails.labs.length > 0) {
        const labHeader = document.createElement('div');
        labHeader.className = 'session-type-header';
        labHeader.style.backgroundColor = '#D1FAE5';
        labHeader.style.color = '#065F46';
        labHeader.innerHTML = '<svg style="width:16px;height:16px;margin-right:6px" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.344c2.672 0 4.011-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.994 1.994 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clip-rule="evenodd"/></svg> Labs';
        container.appendChild(labHeader);

        courseDetails.labs.forEach((lab, index) => {
            container.appendChild(createSessionCard(lab, 'labs', index));
        });
    }

    // Add tutorials
    if (courseDetails.tutorials && courseDetails.tutorials.length > 0) {
        const tutorialHeader = document.createElement('div');
        tutorialHeader.className = 'session-type-header';
        tutorialHeader.style.backgroundColor = '#EDE9FE';
        tutorialHeader.style.color = '#5B21B6';
        tutorialHeader.innerHTML = '<svg style="width:16px;height:16px;margin-right:6px" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg> Tutorials';
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
    // Update step progress
    updateStepProgress(idToShow);
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
        const pos = filteredIndexes.indexOf(window.viewIndex);
        const prevPos = (pos <= 0 ? filteredIndexes.length - 1 : pos - 1);
        window.viewIndex = filteredIndexes[prevPos];
    } else {
        window.viewIndex--;
        if (window.viewIndex < 0) { window.viewIndex = schedules.length - 1; }
    }
    renderSchedule(schedules[window.viewIndex], "schedule-details-container", window.assignedColors || {});
    updateResultsSummary();
});

// Next schedule button
document.getElementById("next").addEventListener("click", function () {
    const schedules = window.allSchedules || [];
    if (schedules.length === 0) return;
    if (filteredIndexes && filteredIndexes.length > 0) {
        const pos = filteredIndexes.indexOf(window.viewIndex);
        const nextPos = (pos >= filteredIndexes.length - 1 ? 0 : pos + 1);
        window.viewIndex = filteredIndexes[nextPos];
    } else {
        window.viewIndex++;
        if (window.viewIndex >= schedules.length) { window.viewIndex = 0; }
    }
    renderSchedule(schedules[window.viewIndex], "schedule-details-container", window.assignedColors || {});
    updateResultsSummary();
});

// Save schedule button
document.getElementById("save-schedule-button").addEventListener("click", function () {
    localStorage.setItem('savedSchedule', JSON.stringify(allSchedules[window.viewIndex]));
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
// After generation, allow going back to filters
const scheduleBackToFiltersBtn = document.getElementById('schedule-stage-back');
if (scheduleBackToFiltersBtn) {
    scheduleBackToFiltersBtn.addEventListener('click', function () {
        showStage('filter-selection-menu');
    });
}
const scheduleBackToFiltersBtnBottom = document.getElementById('schedule-stage-back-bottom');
if (scheduleBackToFiltersBtnBottom) {
    scheduleBackToFiltersBtnBottom.addEventListener('click', function () {
        showStage('filter-selection-menu');
    });
}

// When schedules are ready, switch to schedule stage
// In worker.onmessage -> processResults():
// showStage('schedule-details-container');
// document.getElementById("center-container").style.display = "none"; // not needed if using showStage

// Immutable base palette - User's specified color palette
// Steel Red, Fantasy Orange, Leila, Aesthetic Teal, Light Ocean Green
window.BASE_COURSE_COLORS = [
    ["#D74C4C", "#FFFFFF"],  // Steel Red
    ["#F49729", "#FFFFFF"],  // Fantasy Orange
    ["#27284E", "#FFFFFF"],  // Leila (dark blue)
    ["#1A9399", "#FFFFFF"],  // Aesthetic Teal
    ["#7CCBA9", "#27284E"],  // Light Ocean Green (dark text)
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
            window.generatedScheduleCount = window.allSchedules.length;
            console.log("Total schedules found: " + allSchedules.length);
            // document.getElementById("center-container").style.display = "none";
            // document.getElementById("schedule-details-container").style.display = "block";
            renderSchedule(allSchedules[0], "schedule-details-container", assignedColors);
            window.viewIndex = 0;
            filteredIndexes = null;
            if (window.activeDaysOff) window.activeDaysOff.clear();
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

    // Wire Clear Locks button
    const clearLocksBtn = document.getElementById('clear-locks-btn');
    if (clearLocksBtn) clearLocksBtn.addEventListener('click', () => {
        if (window.scheduleApp?.clearAllLocks) {
            window.scheduleApp.clearAllLocks();
        }
    });
}

// Ensure buttons are wired once DOM is ready (module executes after HTML load)
wireDayOffButtons();