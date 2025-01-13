import { findSchedule } from './scheduleFinder.js';  // Adjust the path as needed
import { initFileHandler } from './filesHandler.js';
import { renderSchedule } from './uiFunctions.js';
import { showAlert } from './alert.js';

// Initialize the file handler
initFileHandler(); //TODO: only load when needed

window.selectedResults = null; //Temporary to check if courses are selected

fetch('nav.html')
    .then(response => response.text())
    .then(data => {
    document.getElementById('navbar').innerHTML = data;
});
fetch('scheduleVisuals.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('schedule-container').innerHTML = data;
});

function getSelectedFilters() {
    //Get filter values first
    const chosenDays = document.querySelector('input[name="numOfDays"]:checked');
    const chosenGaps = document.querySelector('input[name="findSchedulesWithGaps"]:checked');
    const chosenLabOrTutorialAfterLecture = document.querySelector('input[name="checkLabOrTutorialAfterLecture"]:checked');
    //Pack the filter values into an object to pass to the schedule generator
    const filterData = {
        days: chosenDays ? chosenDays.value : "any", //default to any if no value is selected
        numOfDays: chosenDays ? chosenDays.value : "any", //default to any if no value is selected
        gaps: chosenGaps ? chosenGaps.value : false, //default to false if no value is selected
        labOrTutorialAfterLecture: chosenLabOrTutorialAfterLecture ? chosenLabOrTutorialAfterLecture.value : false //default to false if no value is selected
    };
    return filterData;
}

let viewIndex = 0;

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

document.getElementById("show-filter-menu-button").addEventListener("click", function() {
    if(!selectedResults){
        showAlert("No courses selected", "Please select courses first");
        return;
    }
    document.getElementById("course-selection-container").style.display = "none";
    document.getElementById("filter-selection-menu").style.display = "block";
});

// Make schedule button
document.getElementById("processButton").addEventListener("click", function() {
    const filterData = getSelectedFilters();
    window.allSchedules = findSchedule(selectedResults,filterData);
    console.log("Total schedules found: " + allSchedules.length);
    document.getElementById("center-container").style.display = "none";
    document.getElementById("schedule-details-container").style.display = "block";
    renderSchedule(allSchedules[0]);
    viewIndex = 0;
});

document.getElementById("back").addEventListener("click", function() {
    viewIndex--;
    if(viewIndex < 0){
        viewIndex = allSchedules.length - 1;
    }
    renderSchedule(allSchedules[viewIndex]);
});

document.getElementById("next").addEventListener("click", function() {
    viewIndex++;
    if(viewIndex >= allSchedules.length){
        viewIndex = 0;
    }
    renderSchedule(allSchedules[viewIndex]);
});

document.getElementById("save-schedule-button").addEventListener("click", function() {
    localStorage.setItem('savedSchedule', JSON.stringify(allSchedules[viewIndex]));
    showAlert("Schedule saved", "Your schedule has been saved", "myschedule.html", "View schedule");
});

//Course selection cards code
export function loadCourseCardView(courses) {
    const courseGrid = document.getElementById('courseGrid');
    const selectedCourses = new Set(); // To track selected course IDs

    Object.entries(courses).forEach(([courseId, course]) => {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.dataset.id = courseId; // Use the courseId (key) here


        //TODO: add more details to the card
        card.innerHTML = ` 
        <div class="course-card-title">Course ID</div>
        <div class="course-card-code">${courseId}</div>
        <div class="course-card-details">Level:2&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CR:4.0</div>
        `;
        // card.innerHTML = `
        // <div class="course-card-title">${course.title}</div>
        // <div class="course-card-code">${courseId}</div>
        // <div class="course-card-level">${course.level}</div>
        // <div class="course-card-creditHours">${course.creditHours}</div>
        // `;

        // Add click event listener
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

        courseGrid.appendChild(card);
    });
}