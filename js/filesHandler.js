import { loadCourseCardView } from './scheduleFinderMain.js';

export function initFileHandler(){
    document.getElementById("fileInput").addEventListener("change", function(event) {
        const file = event.target.files[0];
        if (file) {
            handleFileInput(file);
        } else {
            console.log("No file selected");
        }
    });
}

// New function to handle file input
function handleFileInput(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        parseCSV(event.target.result);
    };
    reader.readAsText(file);
}

// Modified parseCSV to accept string content
export function parseCSV(csvContent) {
    const rows = csvContent.split("\n").map(row => row.trim());
    const headers = rows[0].split(",").map(header => header.trim());
    const courses = {};
    const courseDetails = {}; // New object for course metadata

    for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(",").map(value => value.trim());

        if (values.length !== headers.length) {
            console.warn(`Skipping row ${i} due to mismatched columns`);
            continue;
        }

        const entry = {};
        headers.forEach((header, index) => {
            entry[header] = values[index];
        });

        // Extract course metadata if fields exist
        const courseCode = entry['Course code'];
        if (courseCode) {
            if (!courseDetails[courseCode]) {
                courseDetails[courseCode] = {
                    courseName: entry['Course name'],
                    creditHours: entry['Credit hours'],
                    level: entry['Level'],
                    program: entry['program']
                };
            }
        }

        // Existing session processing logic
        const { course, class: className, day, start, end, location, lecturer, type } = entry;

        if (!course || !type) {
            console.warn(`Skipping row ${i} due to missing 'course' or 'type'`);
            continue;
        }

        if (!courses[course]) {
            courses[course] = { lectures: [], labs: [], tutorials: [] };
        }

        const session = { course, class: className, day, start, end, location, lecturer };

        switch (type) {
            case "LEC":
                courses[course].lectures.push(session);
                break;
            case "LAB":
                courses[course].labs.push(session);
                break;
            case "TUT":
                courses[course].tutorials.push(session);
                break;
            default:
                console.warn(`Unrecognized type '${type}' at row ${i}`);
        }
    }

    // Pass both datasets to the view if needed (modify loadCourseCardView as required)
    loadCourseCardView(courses, "courseGrid");
    
    // Store data globally and in localStorage
    window.courses = courses;
    window.courseDetails = courseDetails;
    localStorage.setItem('coursesData', JSON.stringify(courses));
    localStorage.setItem('courseDetails', JSON.stringify(courseDetails));
    localStorage.setItem('coursesDataDate', new Date().toISOString());
}

//--------------------End of import code--------------------