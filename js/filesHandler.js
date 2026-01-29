import { loadCourseCardView } from './scheduleFinderMain.js';
import { parseCSVContent } from './csvParser.js';
// Modified parseCSV to accept string content

export function initFileHandler() {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
        fileInput.addEventListener("change", function (event) {
            const file = event.target.files[0];
            if (file) {
                handleFileInput(file);
            } else {
                console.log("No file selected");
            }
        });
    } else {
        console.warn("Element with id 'fileInput' not found.");
    }
}

function handleFileInput(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
        parseCSV(event.target.result);
    };
    reader.readAsText(file);
}

export function parseCSV(csvContent) {
    const { courses, courseDetails } = parseCSVContent(csvContent);

    // Store data globally and in localStorage FIRST (before UI renders)
    window.courses = courses;
    window.courseDetails = courseDetails;
    localStorage.setItem('coursesData', JSON.stringify(courses));
    localStorage.setItem('courseDetails', JSON.stringify(courseDetails));
    localStorage.setItem('coursesDataDate', new Date().toISOString());

    // NOW render the UI (it can read from localStorage)
    loadCourseCardView(courses, "courseGrid");
}

//--------------------End of import code--------------------