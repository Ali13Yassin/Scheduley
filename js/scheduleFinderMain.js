// import { findSchedule } from './scheduleFinder.js';  // Adjust the path as needed
import { initFileHandler , parseCSV } from './filesHandler.js';
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
    //Get filter values first
    const chosenDays = document.querySelector('input[name="numOfDays"]:checked');
    const chosenGaps = document.querySelector('input[name="findSchedulesWithGaps"]:checked');
    const chosenLabOrTutorialAfterLecture = document.querySelector('input[name="checkLabOrTutorialAfterLecture"]:checked');
    const chosenRemoveSingleSessionDays = document.querySelector('input[name="removeSingleSessionDays"]:checked');
    //Pack the filter values into an object to pass to the schedule generator
    const filterData = {
        days: chosenDays ? chosenDays.value : "any", //default to any if no value is selected
        numOfDays: chosenDays ? chosenDays.value : "any", //default to any if no value is selected
        gaps: chosenGaps ? chosenGaps.value : false, //default to false if no value is selected
        labOrTutorialAfterLecture: chosenLabOrTutorialAfterLecture ? chosenLabOrTutorialAfterLecture.value : false, //default to false if no value is selected
        chosenRemoveSingleSessionDays: chosenRemoveSingleSessionDays ? chosenRemoveSingleSessionDays.value : false //default to false if no value is selected
    };
    return filterData;
}

let viewIndex = 0;



//Course selection cards code
export function loadCourseCardView(courses, divId) {
    const courseGrid = document.getElementById(divId);
    const selectedCourses = new Set(); // To track selected course IDs
    // Get courses from localStorage
    const detailsString = localStorage.getItem('courseDetails');
    if (detailsString) {
        const metadata = JSON.parse(detailsString);
        courseGrid.innerHTML = ''; // Clear existing content before loading
    Object.entries(courses).forEach(([courseId, course]) => {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.dataset.id = courseId; // Use the courseId (key) here
        const courseInfo = metadata[courseId] || {
            courseName: courseId,
            level: "Unknown",
            creditHours: "Unknown"
        };
       
        //TODO: add more details to the card
        card.innerHTML = ` 
        <div class="course-card-title">${courseInfo["courseName"]}</div>
        <div class="course-card-code">${courseId}</div>
        <div class="course-card-details">Level:${courseInfo["level"]}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CH:${courseInfo["creditHours"]}</div>
        `;
        
        if(divId === "courseGrid"){
            card.addEventListener('click', () => {
                // Toggle selection
                if (selectedCourses.has(courseId)) {
                    selectedCourses.delete(courseId); // Remove from selected set
                    card.classList.remove('selected'); // Remove highlight
                    window.selectedResults = Array.from(selectedCourses); // TODO: not store in global
                } else {
                    selectedCourses.add(courseId); // Add to selected set
                    card.classList.add('selected'); // Highlight card
                    window.selectedResults = Array.from(selectedCourses);
                }
                });
        }else{
            card.addEventListener('click', () => {
                // Toggle selection
                showSelectedCoursesDetails(courseId);
                document.getElementById("mycourse-selection-container").style.display = "none";
                document.getElementById("course-details-container").style.display = "block";
                });
        }
        

        courseGrid.appendChild(card);
    });
    }
}

async function fetchCSV(url) {
    const response = await fetch(url);
    const text = await response.text();
    parseCSV(text);
    document.getElementById("online-import-container").style.display = "none";
    document.getElementById("course-selection-container").style.display = "block";
}

function showLoadingOverlay(text){
    processOverlay.style.opacity = "1";
    processOverlay.style.visibility = "visible";
    document.getElementById('process-title').textContent = text;
}
function hideLoadingOverlay(){
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
            lecture: [],
            lab: [],
            tutorial: []
        };
    }

    function createSessionCard(session, type, index) {
        const card = document.createElement('div');
        card.className = 'course-card';
        const sessionType = type.toLowerCase();

        card.innerHTML = `
            <div class="session-card-title">${session.class}</div>
            <div class="session-card-details">
                Day: ${session.day}<br>
                Time: ${session.start} - ${session.end}<br>
                Location: ${session.location}<br>
                Lecturer: ${session.lecturer}
            </div>
        `;

        // Check existing selections
        const isSelected = window.selectedSessionsToRemove[courseId][sessionType]
            .some(s => JSON.stringify(s) === JSON.stringify(session));
        if (isSelected) card.classList.add('selected');

        card.addEventListener('click', () => {
            const sessionsArray = window.selectedSessionsToRemove[courseId][sessionType];
            const sessionIndex = sessionsArray.findIndex(s => 
                JSON.stringify(s) === JSON.stringify(session));

            if (card.classList.contains('selected')) {
                // Remove selection
                card.classList.remove('selected');
                sessionsArray.splice(sessionIndex, 1);
            } else {
                // Add selection
                card.classList.add('selected');
                sessionsArray.push(session);
            }
            
            // persistSelectedSessions();
            updateTimetablePreview();
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
            container.appendChild(createSessionCard(lecture, 'Lecture', index));
        });
    }

    // Add labs
    if (courseDetails.labs && courseDetails.labs.length > 0) {
        const labHeader = document.createElement('div');
        labHeader.className = 'session-type-header';
        labHeader.textContent = 'Labs';
        container.appendChild(labHeader);

        courseDetails.labs.forEach((lab, index) => {
            container.appendChild(createSessionCard(lab, 'Lab', index));
        });
}

// Add tutorials
if (courseDetails.tutorials && courseDetails.tutorials.length > 0) {
    const tutorialHeader = document.createElement('div');
    tutorialHeader.className = 'session-type-header';
    tutorialHeader.textContent = 'Tutorials';
    container.appendChild(tutorialHeader);

    courseDetails.tutorials.forEach((tutorial, index) => {
        container.appendChild(createSessionCard(tutorial, 'Tutorial', index));
    });
}
}

// Example timetable preview update function
function updateTimetablePreview() {
    // Implementation to update a timetable display based on selectedSessions
    console.log('Current selections:', window.selectedSessionsToRemove);
}


// Schedule navigation buttons

// Online Import schedule buttons
document.getElementById("SUT-online-import").addEventListener("click", function() {
    showLoadingOverlay("Downloading information");
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeTRwHHeotLdbmKxQqY3j6XIfD_-AoF4iErQGQOo9J3GwKLXFX9EYqQWGmpwyo7CW9djuv1Ck5efm0/pub?gid=755763171&single=true&output=csv";
    fetchCSV(url)
    .then(() => hideLoadingOverlay());
});

// Back schedule button
document.getElementById("back").addEventListener("click", function() {
    viewIndex--;
    if(viewIndex < 0){
        viewIndex = allSchedules.length - 1;
    }
    renderSchedule(allSchedules[viewIndex], "schedule-details-container");
});

// Next schedule button
document.getElementById("next").addEventListener("click", function() {
    viewIndex++;
    if(viewIndex >= allSchedules.length){
        viewIndex = 0;
    }
    renderSchedule(allSchedules[viewIndex], "schedule-details-container");
});

// Save schedule button
document.getElementById("save-schedule-button").addEventListener("click", function() {
    localStorage.setItem('savedSchedule', JSON.stringify(allSchedules[viewIndex]));
    showAlert("Schedule saved", "This DOES NOT register you in this course, you need to manually register in SIS!", "myschedule.html", "View schedule");
});

// Import schedule buttons
document.getElementById("upload-button").addEventListener("click", function() {
    document.getElementById("online-import-container").style.display = "none";
    document.getElementById("upload-container").style.display = "block";
});

// Filter menu buttons
document.getElementById("show-filter-menu-button").addEventListener("click", function() {
    // TODO: check if a course has no sessions chosen
    console.log(selectedSessionsToRemove);
    document.getElementById("mycourse-selection-container").style.display = "none";
    document.getElementById("filter-selection-menu").style.display = "block";
});
document.getElementById("save-mycourse-details").addEventListener("click", function() {

    document.getElementById("course-details-container").style.display = "none";
    document.getElementById("mycourse-selection-container").style.display = "block";
});

// Import schedule button
document.getElementById("save-import-button").addEventListener("click", function() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) {
        showAlert("No data found", "Please upload a schedule file first");
        return;
    }
    const savedSchedule = localStorage.getItem('coursesData');
    if (!savedSchedule) {
        showAlert("An error happened", "Please import a schedule again");
        return;
    }
    // Change the style of the upload container
    document.getElementById("upload-container").style.display = "none";
    document.getElementById("course-selection-container").style.display = "block";
});

document.getElementById("show-mycourse-details-button").addEventListener("click", function() {
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


// Make schedule button
document.getElementById("processButton").addEventListener("click", function() {
    const filterData = getSelectedFilters();
    const startTime = Date.now();
    worker.postMessage({selectedResults, filterData, coursesData: JSON.parse(localStorage.getItem('coursesData'))});
    showLoadingOverlay("Finding Your Schedule");
    worker.onmessage = function(e) {
        let data = e.data;
        console.log(data);
        if (data.type === "error") {
            console.error("Worker error:", data.message);
            showAlert("An error happened", "Please try again");
            hideLoadingOverlay();
            return;
        }
        
        const timeElapsed = Date.now() - startTime;
        const minimumLoadTime = 5000; // 10 seconds

        const processResults = () => {
            if (data.schedules.length === 0) {
                showAlert("No schedules found", "Try adjusting your filters");
                hideLoadingOverlay();
                return;
            }
            window.allSchedules = data.schedules;
            console.log("Total schedules found: " + allSchedules.length);
            document.getElementById("center-container").style.display = "none";
            document.getElementById("schedule-details-container").style.display = "block";
            renderSchedule(allSchedules[0], "schedule-details-container");
            viewIndex = 0;
            hideLoadingOverlay();
        };

        if (timeElapsed < minimumLoadTime) {
            setTimeout(processResults, minimumLoadTime - timeElapsed);
        } else {
            processResults();
        }
    };
    worker.onerror = function(event) {
        console.error("Worker error:", event.message);
    };
});